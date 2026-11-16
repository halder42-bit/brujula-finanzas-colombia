/* Brújula Cloud — Supabase Auth + PostgreSQL privado.
 * Se activa SOLO cuando cloud-config.js tiene URL y clave pública.
 * Sin configuración, la app sigue funcionando 100% local y sin conexión externa.
 * Nunca usar la clave service_role ni guardar datos financieros en GitHub.
 */
(() => {
  'use strict';
  if (!window.BRUJULA_CLOUD_ENABLED) return;

  const project = window.BRUJULA_CLOUD;
  const gate = document.createElement('section');
  gate.id = 'brujula-cloud-gate';
  gate.setAttribute('aria-live', 'polite');
  document.body.appendChild(gate);

  let client = null;
  let userId = null;
  let userEmail = '';
  let revision = null;
  let ready = false;
  let locked = false;
  let sending = false;
  let pending = null;
  let syncTimer = null;
  let sequence = 0;
  let loadingFor = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cloudPath = window.location.origin + window.location.pathname;

  function setGate(content) {
    ready = false;
    document.documentElement.classList.remove('brujula-cloud-ready');
    gate.hidden = false;
    gate.innerHTML = '<div class="cloud-gate-card">' +
      '<div class="cloud-brand">◈ Brújula <span>· Datos en la nube</span></div>' +
      content + '</div>';
  }
  function showLoading(text) {
    setGate('<h2>Conectando con tus finanzas</h2><p>' + escape(text) + '</p>' +
      '<div class="cloud-spinner" aria-label="Cargando"></div>');
  }
  function showLogin(message='') {
    userId = null;
    userEmail = '';
    revision = null;
    pending = null;
    locked = false;
    setGate('<h2>Ingresa a tu cuenta</h2>' +
      '<p>Tu dinero, presupuestos y metas se guardarán en tu cuenta privada. Usa el mismo correo para entrar desde otro dispositivo.</p>' +
      (message ? '<p class="cloud-gate-message">' + escape(message) + '</p>' : '') +
      '<form id="cloud-login-form" class="cloud-auth-form">' +
      '<label for="cloud-email">Correo electrónico</label>' +
      '<input id="cloud-email" type="email" name="email" autocomplete="email" placeholder="tunombre@correo.com" required maxlength="254">' +
      '<button type="submit" class="cloud-primary-btn">Recibir enlace de acceso</button>' +
      '</form>' +
      '<p class="cloud-gate-note">Recibirás un enlace de acceso en tu correo. No necesitas contraseña. Cada usuario ve exclusivamente sus propios registros.</p>');
  }
  function legacySnapshot() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const hasData = (raw.transactions?.length || raw.goals?.length ||
        raw.goalEntries?.length || raw.tasks?.length || raw.transfers?.length ||
        Object.keys(raw.budgets || {}).length || Object.keys(raw.fiscal || {}).length ||
        raw.wallets?.configured || raw.balance?.configured);
      return hasData ? raw : null;
    } catch { return null; }
  }
  function localBackup(raw) {
    const blob = new Blob([JSON.stringify({
      app: 'Brujula', version: 5, exportedAt: new Date().toISOString(), data: raw
    }, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'brujula-copia-local-antes-de-nube.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
  function showFirstLogin() {
    const old = legacySnapshot();
    const count = old?.transactions?.length || 0;
    setGate('<h2>Tu espacio está listo</h2>' +
      '<p>Esta cuenta todavía no tiene un documento financiero guardado en la nube.</p>' +
      (old ? '<div class="cloud-migrate-tip"><strong>Hay información en este navegador</strong>' +
        '<p>Se encontraron ' + count + ' movimientos guardados localmente, además de otros posibles datos. ' +
        'Impórtalos <strong>solo si te pertenecen</strong>. Se enviarán exclusivamente a tu cuenta.</p></div>' : '') +
      (old ? '<button type="button" class="cloud-primary-btn" data-cloud="migrate">Importar mis datos locales a la nube</button>' +
        '<button type="button" class="cloud-secondary-btn" data-cloud="backup">Descargar respaldo local antes de continuar</button>' : '') +
      '<button type="button" class="' + (old?'cloud-secondary-btn':'cloud-primary-btn') +
      '" data-cloud="start">Empezar una cuenta vacía en la nube</button>' +
      '<button type="button" class="cloud-text-btn" data-cloud="logout">Usar otro correo</button>' +
      '<p class="cloud-gate-note">No se sobrescribirá ningún dato remoto existente. La copia local solo se borra automáticamente si eliges importarla y la nube confirma que se guardó.</p>');
  }
  function status(textValue, kind='normal') {
    const el = document.getElementById('cloud-sync-status');
    if (!el) return;
    el.textContent = textValue;
    el.dataset.kind = kind;
  }
  function sidebar() {
    const slot = document.querySelector('.sidebar-bottom');
    if (!slot) return;
    slot.innerHTML = '<span class="side-badge">NUBE PRIVADA</span>' +
      '<b>Tu cuenta</b><p id="cloud-user-email">' + escape(userEmail) + '</p>' +
      '<p id="cloud-sync-status" data-kind="normal">Conectado</p>' +
      '<button type="button" class="cloud-sidebar-btn" data-cloud="refresh">Actualizar desde la nube</button>' +
      '<button type="button" class="cloud-sidebar-btn cloud-logout" data-cloud="logout">Cerrar sesión</button>' +
      '<p class="cloud-gate-note">Usa «Descargar respaldo JSON» regularmente.</p>';
    // El pie anterior describía solo el modo local.
    const footer = document.querySelector('.footer-note');
    if (footer) footer.textContent = 'Brújula · Datos privados sincronizados mediante Supabase · ' +
      'Las alertas fiscales son orientativas y no reemplazan asesoría profesional.';
  }
  function showApp(data, serverRevision) {
    db = normalize(data);
    revision = Number(serverRevision);
    ready = true;
    locked = false;
    pending = null;
    document.documentElement.classList.add('brujula-cloud-ready');
    gate.hidden = true;
    st.view = 'dashboard';
    st.transactionFilter = 'all';
    st.search = '';
    st.highlightTx = null;
    sidebar();
    render();
    status('Guardado en la nube');
  }
  function showProblem(error) {
    const details = error?.message || String(error || 'Error de conexión');
    setGate('<h2>No se pudieron cargar tus datos</h2>' +
      '<p>La aplicación permanece bloqueada para evitar guardar sobre información de otra cuenta.</p>' +
      '<p class="cloud-gate-message">' + escape(details) + '</p>' +
      '<button type="button" class="cloud-primary-btn" data-cloud="retry">Reintentar conexión</button>' +
      '<button type="button" class="cloud-secondary-btn" data-cloud="logout">Cerrar sesión</button>' +
      '<p class="cloud-gate-note">Verifica que hayas ejecutado supabase/schema.sql en tu proyecto y configurado sus permisos.</p>');
  }
  async function loadUser() {
    if (!client) return;
    const ticket = ++sequence;
    loadingFor = true;
    pending = null;
    locked = false;
    showLoading('Comprobando tu sesión y tu documento privado…');
    try {
      const {data:identity,error:identityError} = await client.auth.getUser();
      if (ticket !== sequence) return;
      if (identityError || !identity?.user) {
        showLogin('La sesión venció. Solicita un nuevo enlace para entrar.');
        return;
      }
      userId = identity.user.id;
      userEmail = identity.user.email || '';
      const {data:row,error} = await client.from('brujula_data')
        .select('payload,revision').eq('user_id',userId).maybeSingle();
      if (ticket !== sequence) return;
      if (error) return showProblem(error);
      if (row) showApp(row.payload,row.revision);
      else showFirstLogin();
    } catch(error) {
      if (ticket === sequence) showProblem(error);
    } finally {
      loadingFor = false;
    }
  }
  function enqueue(data) {
    if (!ready || !userId || locked) return false;
    // Snapshot inmutable: guardar exactamente el último estado de la interfaz.
    pending = JSON.parse(JSON.stringify(data));
    status('Cambios pendientes de guardar…','pending');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { void flush(); }, 350);
    return true;
  }
  async function flush() {
    if (!ready || locked || sending || !userId || pending===null) return;
    const owner = userId;
    const snapshot = pending;
    const expected = revision;
    pending = null;
    sending = true;
    status('Guardando en la nube…','pending');
    try {
      // Control de versiones: nunca sobrescribir silenciosamente cambios de otro dispositivo.
      const {data:row,error} = await client.from('brujula_data')
        .update({payload:snapshot,revision:expected+1,updated_at:new Date().toISOString()})
        .eq('user_id',owner).eq('revision',expected).select('revision').maybeSingle();
      if (owner !== userId) return;
      if (error) throw error;
      if (!row) {
        pending = pending || snapshot;
        locked = true;
        status('Conflicto: cambios sin guardar','error');
        showConflict();
        return;
      }
      revision = Number(row.revision);
      status(pending===null?'Guardado en la nube':'Hay cambios pendientes',
        pending===null?'normal':'pending');
    } catch(error) {
      if (owner !== userId) return;
      pending = pending || snapshot;
      status('Sin guardar: revisa tu conexión','error');
      // No descartar lo editado; reintentar al recuperar conexión.
    } finally {
      sending = false;
      if (pending!==null && !locked && owner===userId) {
        clearTimeout(syncTimer);
        syncTimer=setTimeout(() => {void flush();}, 4500);
      }
    }
  }
  function showConflict() {
    setGate('<h2>Otra sesión modificó tus finanzas</h2>' +
      '<p>Los registros guardados desde otro dispositivo no se sobrescribirán. ' +
      'Tus modificaciones actuales siguen en la memoria de esta pestaña.</p>' +
      '<button type="button" class="cloud-primary-btn" data-cloud="backup-draft">Descargar copia de mis cambios</button>' +
      '<button type="button" class="cloud-secondary-btn" data-cloud="reload">Descartar cambios de esta pestaña y cargar la nube</button>' +
      '<p class="cloud-gate-note">Descarga primero tu respaldo si quieres conservar ambos conjuntos de modificaciones.</p>');
  }
  async function createFirstRecord(importOld) {
    if (!userId || !client) return;
    const raw = importOld ? legacySnapshot() : null;
    if (importOld && !raw) return showFirstLogin();
    const payload = normalize(raw);
    showLoading('Creando tu documento privado…');
    try {
      const {data:row,error} = await client.from('brujula_data')
        .insert({user_id:userId,payload,revision:1}).select('revision').single();
      if (error) throw error;
      showApp(payload,row.revision);
      if (importOld) {
        // El borrado sucede SOLO después de que el servidor confirma la escritura.
        localStorage.removeItem(KEY);
        status('Datos locales importados a la nube');
      }
    } catch(error) {
      showProblem(error);
    }
  }
  async function reloadRemote() {
    if (!client || !userId || sending) return;
    pending = null;
    locked = false;
    await loadUser();
  }
  async function refreshRemote() {
    if (!ready || sending || pending!==null) {
      status('Primero se deben guardar los cambios pendientes','pending');
      return;
    }
    try {
      const {data:row,error}=await client.from('brujula_data')
        .select('payload,revision').eq('user_id',userId).single();
      if (error) throw error;
      if (Number(row.revision)!==revision) showApp(row.payload,row.revision);
      status('Datos al día con la nube');
    } catch(error) {
      status('No fue posible actualizar desde la nube','error');
    }
  }
  async function logout() {
    if ((sending || pending!==null) &&
        !window.confirm('Hay cambios sin guardar en la nube. ¿Cerrar sesión y descartarlos?')) return;
    ++sequence;
    ready=false;
    locked=false;
    pending=null;
    userId=null;
    revision=null;
    clearTimeout(syncTimer);
    db = normalize(null);
    render();
    showLoading('Cerrando sesión…');
    const {error} = await client.auth.signOut();
    if (error) showLogin('No se pudo cerrar la sesión completamente: ' + error.message);
    else showLogin();
  }
  async function signIn(email) {
    showLoading('Enviando un enlace de acceso a tu correo…');
    const {error}=await client.auth.signInWithOtp({
      email,
      options:{emailRedirectTo:cloudPath,shouldCreateUser:true}
    });
    showLogin(error ?
      'No se pudo enviar el enlace: ' + error.message :
      'Revisa tu correo, abre el enlace y regresarás a Brújula con tu cuenta.');
  }

  gate.addEventListener('submit',event => {
    if (event.target.id!=='cloud-login-form') return;
    event.preventDefault();
    const email=String(new FormData(event.target).get('email')||'').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) void signIn(email);
  });
  document.addEventListener('click',event => {
    const button=event.target.closest('[data-cloud]');
    if (!button) return;
    const action=button.dataset.cloud;
    event.preventDefault();
    if (action==='backup') {
      const raw=legacySnapshot();
      if (raw) localBackup(raw);
    }
    if (action==='migrate' &&
        window.confirm('¿Confirmas que estos datos locales son tuyos y quieres subirlos a tu cuenta privada?')) {
      void createFirstRecord(true);
    }
    if (action==='start') void createFirstRecord(false);
    if (action==='retry') void loadUser();
    if (action==='refresh') void refreshRemote();
    if (action==='logout') void logout();
    if (action==='backup-draft') localBackup(pending || db);
    if (action==='reload' &&
      window.confirm('Se perderán los cambios NO guardados de esta pestaña. ¿Continuar?')) void reloadRemote();
  });
  window.addEventListener('online',() => {if (pending!==null && ready && !locked) void flush();});
  window.addEventListener('beforeunload',event => {
    if (pending!==null || sending) {event.preventDefault();event.returnValue='';}
  });
  document.addEventListener('visibilitychange',() => {
    if (!document.hidden && ready && !locked && !sending && pending===null) {
      void refreshRemote();
    }
  });
  window.brujulaCloud = {
    get ready() {return ready && !locked},
    enqueue,
    flush,
    get status() {return {ready,sending,unsaved:pending!==null,revision,userId};}
  };

  async function boot() {
    showLoading('Preparando inicio de sesión seguro…');
    try {
      if (!window.supabase?.createClient) {
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          script.onload=resolve;
          script.onerror=()=>reject(new Error('No se pudo cargar la biblioteca de Supabase.'));
          document.head.appendChild(script);
        });
      }
      if (!window.supabase?.createClient) throw new Error('Biblioteca de Supabase no disponible.');
      client=window.supabase.createClient(project.url,project.publishableKey,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      });
      client.auth.onAuthStateChange((event,session)=>{
        if (event==='SIGNED_OUT') {
          setTimeout(()=>{
            ++sequence;
            if (ready) {ready=false;db=normalize(null);render();}
            showLogin();
          },0);
        } else if (event==='SIGNED_IN' && session?.user && !loadingFor) {
          setTimeout(()=>{if (!ready || userId!==session.user.id) void loadUser();},0);
        }
      });
      const {data,error}=await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user) await loadUser();
      else showLogin();
    } catch(error) {
      showProblem(error);
    }
  }
  void boot();
})();
