import { authService } from './auth.service.js';
import { hydrateAuth } from './session.js';
import { store } from '../state/store.js';
import { loadDashboard } from '../features/dashboard/dashboard.js';

const el = id => document.getElementById(id);
const value = id => String(el(id)?.value || '').trim();

function status(message,ok=false){
  const node=el('authStatus');
  if(node){node.textContent=message;node.style.color=ok?'#16803b':'var(--text2)';}
}

function showGate(show){
  const gate=el('authGate');
  if(gate) gate.style.display=show?'flex':'none';
}

function syncLegacyAccess(){
  const state=store.get();
  window.PROFILE_CURRENT = state.profile;
  window.PROFILE_SESSION = state.user ? {user:state.user} : null;
  if(state.profile && typeof window.applyProfileAccess==='function'){
    window.applyProfileAccess();
  }
  if(!state.profile) showGate(true);
}

export async function signInFromUI(){
  try{
    const email=value('authEmail'),password=el('authPassword')?.value||'';
    if(!email||!password) throw new Error('Enter your email and password.');
    status('Signing in...');
    const result=await authService.signIn(email,password);
    store.patch({user:result.user,profile:result.profile,workspace:result.profile.workspace_id,role:result.profile.role});
    syncLegacyAccess();
    await loadDashboard().catch(console.warn);
    status('');
  }catch(error){
    store.patch({user:null,profile:null,workspace:null,role:null});
    status(error.message || 'Could not sign in.');
  }
}

export async function createFirstAdminFromUI(){
  try{
    const name=value('authAdminName'),email=value('authAdminEmail'),password=el('authAdminPassword')?.value||'';
    const workspace = value('sbWorkspace') || localStorage.getItem('eventmedia:workspace') || 'default';
    if(!name||!email||password.length<6) throw new Error('Enter your name, email and a password of at least 6 characters.');
    status('Creating administrator...');
    const result=await authService.createFirstAdmin(email,password,name,workspace);
    if(result.session && result.profile){
      store.patch({user:result.user,profile:result.profile,workspace:result.profile.workspace_id,role:result.profile.role});
      syncLegacyAccess();
      await loadDashboard().catch(console.warn);
      status('Administrator created.',true);
    }else{
      status('Account created. Confirm the email if Supabase requires confirmation, then sign in.',true);
    }
  }catch(error){ status(error.message || 'Could not create administrator.'); }
}

export async function signOutFromUI(){
  await authService.signOut().catch(()=>{});
  store.patch({user:null,profile:null,workspace:null,role:null,data:{clients:[],events:[],invoices:[],payments:[],expenses:[],equipment:[],crew:[]}});
  showGate(true);
  if(typeof window.showAuthMode==='function') window.showAuthMode('login');
}

export async function restoreAuth(){
  try{
    const state=await hydrateAuth();
    syncLegacyAccess();
    if(state) await loadDashboard().catch(console.warn);
    else showGate(true);
  }catch(error){
    console.warn('[Auth] restore failed',error);
    showGate(true);
  }
}
