
(function(){
  const statusNodes = {};

  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function isPrivateAdminProfile(user, profile){
    const email = String(user?.email || profile?.email || '').trim().toLowerCase();
    const username = String(profile?.username || user?.user_metadata?.username || '').trim().toLowerCase();
    return email === 'xflight1125@gmail.com' || username === 'metazoo king';
  }

  async function updateAdminNavVisibility(sb, user){
    const links = document.querySelectorAll('.admin-only-link');
    if(!links.length) return;

    if(!sb || !user){
      document.body.classList.remove('user-is-admin');
      links.forEach(link => link.style.display = 'none');
      return;
    }

    let profile = null;
    try{
      profile = await loadProfile(sb, user);
    }catch(e){}

    const allowed = isPrivateAdminProfile(user, profile);

    document.body.classList.toggle('user-is-admin', allowed);
    links.forEach(link => {
      link.style.display = allowed ? '' : 'none';
    });
  }



  function setLoggedInClass(loggedIn){
    document.body.classList.toggle('user-logged-in', !!loggedIn);
    document.querySelectorAll('a[href="messages.html"], .chat-bell-link').forEach(el => {
      if(el) el.style.display = loggedIn ? '' : 'none';
    });
    document.querySelectorAll('a[href="auth.html"]').forEach(a => {
      const label = a.textContent.trim();
      if(loggedIn && (label === 'Account' || label === 'Login')) a.textContent = 'My Account';
      if(!loggedIn && label === 'My Account') a.textContent = 'Account';
      a.style.display = '';
    });
  }


  async function unreadCountForUser(sb, user){
    const { data, error } = await sb
      .from('conversation_members')
      .select('conversation_id,last_read_at,conversations(last_message_at)')
      .eq('user_id', user.id);

    if(error || !data) return 0;
    let count = 0;
    data.forEach(row => {
      const lastMsg = row.conversations?.last_message_at ? new Date(row.conversations.last_message_at).getTime() : 0;
      const lastRead = row.last_read_at ? new Date(row.last_read_at).getTime() : 0;
      if(lastMsg && lastMsg > lastRead) count++;
    });
    return count;
  }

  async function loadAccountBountyPreview(sb, user){
    const box = document.getElementById('accountBountyPreview');
    if(!box) return;

    const { data, error } = await sb
      .from('user_bounties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending:false })
      .limit(5);

    if(error){
      box.innerHTML = `<div class="auth-status error">${error.message}</div>`;
      return;
    }

    if(!data || !data.length){
      box.innerHTML = `<div class="auth-status info">No bounties yet. Open your dashboard to submit your first bounty.</div>`;
      return;
    }

    box.innerHTML = data.map(b => `
      <article class="user-bounty-item">
        <span class="status-badge ${b.status}">${b.status}</span>
        <h3>${b.title}</h3>
        <p>${b.wanted_details || ''}</p>
        <div class="small-help">Category: ${b.category || 'n/a'} • Offer: ${b.offer_type || 'n/a'}</div>
      
        ${b.status === 'rejected' && b.admin_response ? `<div class="auth-status error" style="margin-top:10px">Admin note: ${b.admin_response}</div>` : ''}</article>
    `).join('');
  }

  async function renderAccountHub(sb, user){
    const hub = document.getElementById('accountHub');
    const forms = document.getElementById('accountAuthForms');
    if(!hub || !forms) return;

    let profile = null;
    try{
      profile = await loadProfile(sb, user);
      if(!profile){
        await ensureProfile(sb, user);
        profile = await loadProfile(sb, user);
      }
    }catch(e){}

    forms.classList.add('logged-in-hidden');
    hub.classList.add('show');
    document.body.classList.add('user-logged-in');

    await updateAdminNavVisibility(sb, user);

    const username = profile?.username || user.email?.split('@')[0] || 'Collector';
    const title = document.getElementById('accountHubTitle');
    const sub = document.getElementById('accountHubSub');

    if(title) title.textContent = `Welcome back, ${username}.`;
    if(sub) sub.textContent = `Logged in as ${user.email}. Your tools, bounties, and messages are ready.`;

    const adminCard = document.getElementById('adminToolCard');
    if(adminCard && isPrivateAdminProfile(user, profile)) adminCard.style.display = '';

    const msgCount = document.getElementById('accountMessageCount');
    if(msgCount){
      const count = await unreadCountForUser(sb, user);
      msgCount.textContent = count ? `(${count} unread)` : '';
    }

    const logout = document.getElementById('accountLogoutBtn');
    if(logout){
      logout.addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.href = 'auth.html';
      });
    }

    await loadAccountBountyPreview(sb, user);
  }


  function setStatus(id, msg, type='info'){
    let el = statusNodes[id] || document.getElementById(id);
    if(!el) return;
    el.textContent = msg;
    el.className = 'auth-status ' + type;
  }

  function isConfigured(){
    return window.REVNRIP_SUPABASE_URL && !window.REVNRIP_SUPABASE_URL.includes('YOUR_SUPABASE') &&
           window.REVNRIP_SUPABASE_ANON_KEY && !window.REVNRIP_SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  }

  function client(){
    if(!isConfigured()) return null;
    return window.supabase.createClient(window.REVNRIP_SUPABASE_URL, window.REVNRIP_SUPABASE_ANON_KEY);
  }

  function slugify(text){
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'bounty';
  }

  async function currentUser(sb){
    const { data: sessionData } = await sb.auth.getSession();
    if(sessionData?.session?.user) return sessionData.session.user;
    const { data } = await sb.auth.getUser();
    return data.user || null;
  }

  async function loadProfile(sb, user){
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if(error) throw error;
    return data;
  }

  async function ensureProfile(sb, user, username){
    const payload = {
      id: user.id,
      email: user.email,
      username: username || user.user_metadata?.username || user.email?.split('@')[0] || 'collector'
    };
    const { error } = await sb.from('profiles').upsert(payload, { onConflict:'id' });
    if(error) throw error;
  }

  async function initAuthPage(){
    const sb = client();
    if(!sb){
      setStatus('loginStatus', 'Supabase is not configured yet. Add your URL and anon key in supabase-config.js.', 'error');
      setStatus('registerStatus', 'Supabase is not configured yet. Add your URL and anon key in supabase-config.js.', 'error');
      return;
    }

    const user = await currentUser(sb);
    if(user){
      await renderAccountHub(sb, user);
      return;
    }

    qs('#registerForm')?.addEventListener('submit', async (event)=>{
      event.preventDefault();
      const form = event.currentTarget;
      const email = form.email.value.trim();
      const password = form.password.value;
      const username = form.username.value.trim();

      setStatus('registerStatus', 'Creating account...', 'info');

      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });

      if(error){
        setStatus('registerStatus', error.message, 'error');
        return;
      }

      if(data.user){
        try{ await ensureProfile(sb, data.user, username); }catch(e){}
      }

      setStatus('registerStatus', 'Account created. Check your email if confirmation is required, then log in.', 'success');
    });

    qs('#loginForm')?.addEventListener('submit', async (event)=>{
      event.preventDefault();
      const form = event.currentTarget;
      setStatus('loginStatus', 'Logging in...', 'info');
      const { error } = await sb.auth.signInWithPassword({
        email: form.email.value.trim(),
        password: form.password.value
      });
      if(error){
        setStatus('loginStatus', error.message, 'error');
        return;
      }
      window.location.href = new URLSearchParams(window.location.search).get('return') || 'auth.html';
    });
  }


  async function submitBountyRecord(sb, user, form, statusId){
    const submitBtn = form.querySelector('button[type="submit"]');
    const oldText = submitBtn ? submitBtn.textContent : '';

    const title = (form.title?.value || '').trim();
    if(!title){
      setStatus(statusId, 'Please enter a bounty title.', 'error');
      return false;
    }

    if(submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    setStatus(statusId, 'Submitting bounty...', 'info');

    try{
      const slugBase = slugify(title);
      const payload = {
        user_id: user.id,
        title: title,
        slug: slugBase + '-' + Date.now().toString(36),
        category: form.category?.value || null,
        wanted_details: form.wanted_details?.value || null,
        offer_type: form.offer_type?.value || null,
        condition_wanted: form.condition_wanted?.value || null,
        budget_range: form.budget_range?.value || null,
        contact_preference: form.contact_preference?.value || null,
        notes: form.notes?.value || null,
        status: 'pending'
      };

      const { data, error } = await sb.from('user_bounties').insert(payload).select().single();
      if(error){
        let help = error.message || 'Unknown Supabase error.';
        if(error.code === '42501') help += ' This usually means Row Level Security blocked the insert.';
        if(error.code === '23503') help += ' This usually means your profile row is missing.';
        setStatus(statusId, help, 'error');
        return false;
      }

      form.reset();
      setStatus(statusId, 'Bounty submitted successfully. It is now pending admin approval.', 'success');
      return data;
    }catch(err){
      setStatus(statusId, err.message || 'Unexpected error while submitting bounty.', 'error');
      return false;
    }finally{
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.textContent = oldText || 'Submit Bounty';
      }
    }
  }

  function wireBountySubmissionForm(sb, user, form, statusId, postSuccess){
    if(!form || form.dataset.bountyWired === 'yes') return;
    form.dataset.bountyWired = 'yes';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await submitBountyRecord(sb, user, event.currentTarget, statusId);
      if(result && typeof postSuccess === 'function') postSuccess(result);
    });
  }

  async function initDashboard(){
    const sb = client();
    if(!sb){
      setStatus('dashboardStatus', 'Supabase is not configured yet. Check supabase-config.js.', 'error');
      return;
    }

    const user = await currentUser(sb);
    if(!user){
      window.location.href = 'auth.html?return=dashboard.html';
      return;
    }

    setLoggedInClass(true);
    await updateAdminNavVisibility(sb, user);

    let profile = null;
    try{
      profile = await loadProfile(sb, user);
      if(!profile){
        await ensureProfile(sb, user);
        profile = await loadProfile(sb, user);
      }
    }catch(profileError){
      console.warn('Profile warning:', profileError);
      setStatus('dashboardStatus', 'Logged in, but your profile could not be loaded. Try refreshing or checking the profiles table.', 'error');
    }

    const profileBox = document.getElementById('profileBox');
    if(profileBox){
      profileBox.innerHTML = `
        <div class="profile-card">
          <span class="eyebrow">Collector Profile</span>
          <h2>${profile?.username || user.user_metadata?.username || 'Collector'}</h2>
          <p>${profile?.email || user.email}</p>
          <div class="small-help">Profile ID: ${user.id}</div>
          ${profile?.is_admin ? '<div class="auth-status success">Admin access enabled. <a href="admin.html" style="text-decoration:underline">Open Admin</a></div>' : ''}
        </div>
      `;
    }

    document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
      await sb.auth.signOut();
      window.location.href = 'auth.html';
    });

    const bountyForm = document.getElementById('bountyForm');
    wireBountySubmissionForm(sb, user, bountyForm, 'dashboardStatus', async ()=>{
      await loadMyBounties(sb, user);
    });

    await loadMyBounties(sb, user);
  }

  async function loadMyBounties(sb, user){
    const box = document.getElementById('myBounties');
    if(!box) return;

    box.innerHTML = `<div class="auth-status info">Loading your bounties...</div>`;

    const { data, error } = await sb
      .from('user_bounties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending:false });

    if(error){
      box.innerHTML = `<div class="auth-status error">${error.message}</div>`;
      return;
    }

    if(!data || !data.length){
      box.innerHTML = `<div class="auth-status info">No bounties submitted yet.</div>`;
      return;
    }

    box.innerHTML = data.map(b => `
      <article class="user-bounty-item">
        <span class="status-badge ${b.status}">${b.status}</span>
        <h3>${b.title}</h3>
        <p>${b.wanted_details || ''}</p>
        <div class="small-help">Category: ${b.category || 'n/a'} • Offer: ${b.offer_type || 'n/a'}</div>
        
        ${b.status === 'rejected' && b.admin_response ? `<div class="auth-status error" style="margin-top:10px">Admin note: ${b.admin_response}</div>` : ''}${b.status === 'approved' ? `<div class="small-help">Public link: <a href="bounty.html#user-${b.slug}" style="text-decoration:underline">bounty.html#user-${b.slug}</a></div>` : ''}
      </article>
    `).join('');
  }

  async function initAdmin(){
    const sb = client();
    if(!sb){
      setStatus('adminStatus', 'Supabase is not configured yet. Add your URL and anon key in supabase-config.js.', 'error');
      return;
    }

    const user = await currentUser(sb);
    if(!user){
      window.location.href = 'auth.html';
      return;
    }

    const profile = await loadProfile(sb, user);
    if(!isPrivateAdminProfile(user, profile)){
      setStatus('adminStatus', 'Admin access is restricted to the private Rev-N-Rip admin account.', 'error');
      return;
    }

    setStatus('adminStatus', 'Admin mode loaded.', 'success');
    loadAdminBounties(sb);
  }

  async function loadAdminBounties(sb){
    const box = document.getElementById('adminBounties');
    if(!box) return;

    box.innerHTML = `<div class="auth-status info">Loading pending bounties...</div>`;

    const { data: bounties, error } = await sb
      .from('user_bounties')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending:false });

    if(error){
      box.innerHTML = `<div class="auth-status error">${error.message}</div>`;
      return;
    }

    if(!bounties || !bounties.length){
      box.innerHTML = `<div class="auth-status success">No pending bounties. The approval bay is clear.</div>`;
      return;
    }

    const userIds = [...new Set(bounties.map(b => b.user_id).filter(Boolean))];

    let profileMap = {};
    if(userIds.length){
      const { data: profiles, error: profileError } = await sb
        .from('profiles')
        .select('id,username,email')
        .in('id', userIds);

      if(!profileError && profiles){
        profiles.forEach(profile => {
          profileMap[profile.id] = profile;
        });
      }
    }

    box.innerHTML = bounties.map(b => {
      const profile = profileMap[b.user_id] || {};
      const safeTitle = String(b.title || '').replace(/"/g, '&quot;');
      return `
        <article class="user-bounty-item" data-bounty-id="${b.id}">
          <span class="status-badge ${b.status}">${b.status}</span>
          <h3>${b.title}</h3>
          <p>${b.wanted_details || ''}</p>
          <div class="small-help">Posted by: @${profile.username || 'collector'} • ${profile.email || 'email unavailable'}</div>
          <div class="small-help">Category: ${b.category || 'n/a'} • Offer: ${b.offer_type || 'n/a'} • Budget: ${b.budget_range || 'n/a'}</div>
          <div class="admin-controls">
            <button class="btn approve-btn" type="button" data-id="${b.id}" data-user="${b.user_id}" data-title="${safeTitle}">Approve + Notify</button>
            <button class="btn secondary reject-btn" type="button" data-id="${b.id}" data-user="${b.user_id}" data-title="${safeTitle}">Deny + Message</button>
          </div>
        </article>
      `;
    }).join('');

    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', () => updateBountyStatus(sb, {
        id: btn.dataset.id,
        userId: btn.dataset.user,
        title: btn.dataset.title,
        status: 'approved'
      }));
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const reason = window.prompt('Why was this bounty denied? This message will be visible to the user.');
        if(reason === null) return;
        const cleanReason = reason.trim();
        if(!cleanReason){
          setStatus('adminStatus', 'Please enter a denial reason so the user knows what to fix.', 'error');
          return;
        }
        updateBountyStatus(sb, {
          id: btn.dataset.id,
          userId: btn.dataset.user,
          title: btn.dataset.title,
          status: 'rejected',
          adminResponse: cleanReason
        });
      });
    });
  }

  async function sendBountyDecisionMessage(sb, decision){
    if(!decision.userId) return { ok:false, message:'No user ID found for notification.' };

    try{
      const { data: currentUserData } = await sb.auth.getUser();
      const adminUser = currentUserData?.user;
      if(!adminUser) return { ok:false, message:'Admin session not found for notification.' };

      const title = decision.title || 'your bounty';
      const isApproved = decision.status === 'approved';

      const body = isApproved
        ? `Good news. Your bounty "${title}" has been approved and is now eligible to appear on the Rev-N-Rip Bounty Board.`
        : `Your bounty "${title}" was denied for now.

Reason: ${decision.adminResponse || 'No reason provided.'}

You can review the note, adjust the bounty details, and submit again.`;

      const { data: convo, error: convoErr } = await sb
        .from('conversations')
        .insert({
          created_by: adminUser.id,
          bounty_slug: 'admin-decision-' + decision.id,
          bounty_title: 'Bounty Decision: ' + title,
          status: 'open'
        })
        .select()
        .single();

      if(convoErr) throw convoErr;

      const members = [
        { conversation_id: convo.id, user_id: adminUser.id, role: 'admin', last_read_at: new Date().toISOString() },
        { conversation_id: convo.id, user_id: decision.userId, role: 'recipient', last_read_at: null }
      ];

      const { error: memberErr } = await sb.from('conversation_members').insert(members);
      if(memberErr) throw memberErr;

      const { error: msgErr } = await sb.from('messages').insert({
        conversation_id: convo.id,
        sender_id: adminUser.id,
        body
      });
      if(msgErr) throw msgErr;

      return { ok:true };
    }catch(err){
      console.warn('Bounty decision notification failed:', err);
      return { ok:false, message: err.message || 'Message notification failed.' };
    }
  }

  async function updateBountyStatus(sb, decision){
    const id = typeof decision === 'string' ? decision : decision.id;
    const status = typeof decision === 'string' ? arguments[2] : decision.status;
    const adminResponse = decision?.adminResponse || null;

    if(!id || !status){
      setStatus('adminStatus', 'Missing bounty ID or status.', 'error');
      return;
    }

    setStatus('adminStatus', status === 'approved' ? 'Approving bounty...' : 'Denying bounty...', 'info');

    let updatePayload = { status };
    if(adminResponse) updatePayload.admin_response = adminResponse;

    let { error } = await sb.from('user_bounties').update(updatePayload).eq('id', id);

    // If the admin_response column has not been added yet, still update status so the bay does not jam.
    if(error && String(error.message || '').toLowerCase().includes('admin_response')){
      const retry = await sb.from('user_bounties').update({ status }).eq('id', id);
      error = retry.error;
    }

    if(error){
      setStatus('adminStatus', error.message, 'error');
      return;
    }

    const notifyResult = await sendBountyDecisionMessage(sb, {
      ...decision,
      id,
      status,
      adminResponse
    });

    const decisionText = status === 'approved' ? 'approved' : 'denied';
    if(notifyResult.ok){
      setStatus('adminStatus', `Bounty ${decisionText}. User was notified through Messages.`, 'success');
    }else{
      setStatus('adminStatus', `Bounty ${decisionText}. Message alert could not be sent: ${notifyResult.message || 'unknown issue'}`, 'error');
    }

    // Remove it from the pending approval bay immediately.
    const card = document.querySelector(`[data-bounty-id="${id}"]`);
    if(card) card.remove();

    const remaining = document.querySelectorAll('#adminBounties [data-bounty-id]').length;
    if(remaining === 0){
      const box = document.getElementById('adminBounties');
      if(box) box.innerHTML = `<div class="auth-status success">No pending bounties. The approval bay is clear.</div>`;
    }
  }

  async function loadActiveBountiesAdmin(sb){
    const box = document.getElementById('activeBountiesAdmin');
    if(!box) return;

    box.innerHTML = `<div class="auth-status info">Loading active bounties...</div>`;

    const { data: bounties, error } = await sb
      .from('user_bounties')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending:false });

    if(error){
      box.innerHTML = `<div class="auth-status error">${error.message}</div>`;
      return;
    }

    if(!bounties || !bounties.length){
      box.innerHTML = `<div class="auth-status info">No approved community bounties are live right now.</div>`;
      return;
    }

    const userIds = [...new Set(bounties.map(b => b.user_id).filter(Boolean))];
    let profileMap = {};
    if(userIds.length){
      const { data: profiles } = await sb
        .from('profiles')
        .select('id,username,email')
        .in('id', userIds);

      if(profiles){
        profiles.forEach(profile => profileMap[profile.id] = profile);
      }
    }

    box.innerHTML = bounties.map(b => {
      const profile = profileMap[b.user_id] || {};
      return `
        <article class="user-bounty-item" data-active-bounty-id="${b.id}">
          <span class="status-badge approved">approved</span>
          <h3>${b.title || 'Untitled Bounty'}</h3>
          <p>${b.wanted_details || ''}</p>
          <div class="small-help">Posted by: @${profile.username || 'collector'} • ${profile.email || 'email unavailable'}</div>
          <div class="small-help">Category: ${b.category || 'n/a'} • Offer: ${b.offer_type || 'n/a'} • Budget: ${b.budget_range || 'n/a'}</div>
          <div class="small-help">Public link: <a href="bounty.html#user-${b.slug}" style="text-decoration:underline">bounty.html#user-${b.slug}</a></div>

          <form class="admin-edit-form" data-edit-bounty-id="${b.id}">
            <input name="title" value="${String(b.title || '').replace(/"/g, '&quot;')}" placeholder="Bounty title" required>
            <select name="category">
              ${['Pokémon','MetaZoo','Sealed','Slab','Star Rare','Other'].map(option => `<option ${option === b.category ? 'selected' : ''}>${option}</option>`).join('')}
            </select>
            <textarea class="full" name="wanted_details" placeholder="Wanted details">${b.wanted_details || ''}</textarea>
            <select name="offer_type">
              ${['Cash','Trade','Consignment','Open to offers'].map(option => `<option ${option === b.offer_type ? 'selected' : ''}>${option}</option>`).join('')}
            </select>
            <input name="condition_wanted" value="${String(b.condition_wanted || '').replace(/"/g, '&quot;')}" placeholder="Condition wanted">
            <input name="budget_range" value="${String(b.budget_range || '').replace(/"/g, '&quot;')}" placeholder="Budget range">
            <input class="full" name="contact_preference" value="${String(b.contact_preference || '').replace(/"/g, '&quot;')}" placeholder="Contact preference">
            <textarea class="full" name="notes" placeholder="Notes">${b.notes || ''}</textarea>
            <div class="full admin-compact-actions">
              <button class="btn save-active-btn" type="submit">Save Changes</button>
              <button class="btn secondary unapprove-active-btn" type="button" data-id="${b.id}" data-user="${b.user_id}" data-title="${String(b.title || '').replace(/"/g, '&quot;')}">Move to Pending</button>
              <button class="btn secondary deny-active-btn" type="button" data-id="${b.id}" data-user="${b.user_id}" data-title="${String(b.title || '').replace(/"/g, '&quot;')}">Deny + Message</button>
              <button class="btn secondary admin-danger-btn delete-active-btn" type="button" data-id="${b.id}" data-user="${b.user_id}" data-title="${String(b.title || '').replace(/"/g, '&quot;')}">Delete Forever</button>
            </div>
          </form>
        </article>
      `;
    }).join('');

    document.querySelectorAll('[data-edit-bounty-id]').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const id = form.dataset.editBountyId;
        await saveActiveBountyEdits(sb, id, form);
      });
    });

    document.querySelectorAll('.unapprove-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if(!confirm('Move this active bounty back to pending review? It will stop showing publicly.')) return;
        await updateBountyStatus(sb, {
          id: btn.dataset.id,
          userId: btn.dataset.user,
          title: btn.dataset.title,
          status: 'pending'
        });
        await loadActiveBountiesAdmin(sb);
      });
    });

    document.querySelectorAll('.deny-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = window.prompt('Why are you denying/removing this active bounty? This message will be visible to the user.');
        if(reason === null) return;
        const cleanReason = reason.trim();
        if(!cleanReason){
          setStatus('adminStatus', 'Please enter a denial reason.', 'error');
          return;
        }
        await updateBountyStatus(sb, {
          id: btn.dataset.id,
          userId: btn.dataset.user,
          title: btn.dataset.title,
          status: 'rejected',
          adminResponse: cleanReason
        });
        await loadActiveBountiesAdmin(sb);
      });
    });

    document.querySelectorAll('.delete-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmText = prompt('Type DELETE to permanently remove this bounty. This cannot be undone.');
        if(confirmText !== 'DELETE') return;
        await deleteActiveBountyForever(sb, {
          id: btn.dataset.id,
          userId: btn.dataset.user,
          title: btn.dataset.title
        });
      });
    });
  }

  async function saveActiveBountyEdits(sb, id, form){
    setStatus('adminStatus', 'Saving bounty edits...', 'info');

    const payload = {
      title: form.title?.value?.trim() || 'Untitled Bounty',
      category: form.category?.value || null,
      wanted_details: form.wanted_details?.value || null,
      offer_type: form.offer_type?.value || null,
      condition_wanted: form.condition_wanted?.value || null,
      budget_range: form.budget_range?.value || null,
      contact_preference: form.contact_preference?.value || null,
      notes: form.notes?.value || null
    };

    const { error } = await sb.from('user_bounties').update(payload).eq('id', id);

    if(error){
      setStatus('adminStatus', error.message, 'error');
      return;
    }

    setStatus('adminStatus', 'Active bounty updated.', 'success');
    await loadActiveBountiesAdmin(sb);
  }

  async function deleteActiveBountyForever(sb, decision){
    setStatus('adminStatus', 'Deleting bounty forever...', 'info');

    const notifyResult = await sendBountyDecisionMessage(sb, {
      ...decision,
      status: 'rejected',
      adminResponse: 'This bounty was removed from the Rev-N-Rip Bounty Board by admin.'
    });

    const { error } = await sb.from('user_bounties').delete().eq('id', decision.id);

    if(error){
      setStatus('adminStatus', error.message, 'error');
      return;
    }

    const card = document.querySelector(`[data-active-bounty-id="${decision.id}"]`);
    if(card) card.remove();

    const remaining = document.querySelectorAll('#activeBountiesAdmin [data-active-bounty-id]').length;
    if(remaining === 0){
      const box = document.getElementById('activeBountiesAdmin');
      if(box) box.innerHTML = `<div class="auth-status info">No approved community bounties are live right now.</div>`;
    }

    if(notifyResult.ok){
      setStatus('adminStatus', 'Bounty deleted forever. User was notified through Messages.', 'success');
    }else{
      setStatus('adminStatus', `Bounty deleted forever. Message alert could not be sent: ${notifyResult.message || 'unknown issue'}`, 'error');
    }
  }

  async function initPublicBounties(){
    const mount = qs('#userSubmittedBounties');
    if(!mount) return;

    const sb = client();
    if(!sb){
      mount.innerHTML = `<div class="auth-status info">User-submitted bounties will appear here after Supabase is connected.</div>`;
      return;
    }

    const { data, error } = await sb
      .from('user_bounties_public')
      .select('*')
      .order('created_at', { ascending:false });

    if(error){
      mount.innerHTML = `<div class="auth-status error">${error.message}</div>`;
      return;
    }

    if(!data.length){
      mount.innerHTML = `<div class="auth-status info">No approved community bounties yet.</div>`;
      return;
    }

    mount.innerHTML = data.map(b => {
      const rawCategory = (b.category || 'community').toLowerCase();
      const category = rawCategory.includes('pok') ? 'pokemon community' :
        rawCategory.includes('meta') ? 'metazoo community' :
        rawCategory.includes('sealed') ? 'sealed community' :
        rawCategory.includes('slab') ? 'slab community' :
        'community';

      return `
        <article class="public-bounty-card" id="user-${b.slug}" data-bounty-category="${category}">
          <div>
            <span class="status-badge approved">Community</span>
            <h3>${b.title}</h3>
            <p>${b.wanted_details || ''}</p>
            <div class="small-help">Posted by: @${b.username || 'collector'} • ${b.category || 'Community'} • ${b.offer_type || 'Open'}</div>
          </div>
          <div class="public-bounty-actions">
            <button class="bounty-response-btn" type="button" data-owner="${b.user_id}" data-bounty-slug="user-${b.slug}" data-bounty-title="${b.title}">I Have This</button>
            <button class="copy-icon-btn bounty-copy-link-btn" type="button" data-dynamic-bounty-link="user-${b.slug}" aria-label="Copy bounty link" title="Copy link"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2" stroke-width="2"></rect><rect x="5" y="5" width="10" height="10" rx="2" stroke-width="2"></rect></svg></button>
          </div>
        </article>
      `;
    }).join('');

    qsa('[data-dynamic-bounty-link]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = window.location.origin + window.location.pathname + '#' + btn.dataset.dynamicBountyLink;
        try{
          await navigator.clipboard.writeText(url);
          btn.classList.add('copied');
          setTimeout(()=> btn.classList.remove('copied'), 1200);
        }catch(e){
          window.prompt('Copy this bounty link:', url);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const adminNavClient = client();
    const currentForAdminNav = adminNavClient ? await currentUser(adminNavClient) : null;
    await updateAdminNavVisibility(adminNavClient, currentForAdminNav);
    const page = document.body.dataset.page;
    if(page === 'auth') initAuthPage();
    if(page === 'dashboard') initDashboard();
    if(page === 'admin') initAdmin();
    if(page === 'bounty') initBountyPage();
    initPublicBounties();
  });
})();
