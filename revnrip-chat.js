
(function(){
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function configured(){
    return window.REVNRIP_SUPABASE_URL && !window.REVNRIP_SUPABASE_URL.includes('YOUR_SUPABASE') &&
           window.REVNRIP_SUPABASE_ANON_KEY && !window.REVNRIP_SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  }

  function sb(){
    if(!configured() || !window.supabase) return null;
    return window.supabase.createClient(window.REVNRIP_SUPABASE_URL, window.REVNRIP_SUPABASE_ANON_KEY);
  }

  async function user(client){
    const { data } = await client.auth.getUser();
    return data.user || null;
  }

  function setStatus(id, msg, type='info'){
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = msg;
    el.className = 'chat-status ' + type;
  }

  function params(){
    return new URLSearchParams(window.location.search);
  }




  async function updatePrivateAdminNav(client, current){
    const links = document.querySelectorAll('.admin-only-link');
    if(!links.length) return;

    if(!client || !current){
      document.body.classList.remove('user-is-admin');
      links.forEach(link => link.style.display = 'none');
      return;
    }

    let profile = null;
    try{
      const { data } = await client
        .from('profiles')
        .select('id,email,username')
        .eq('id', current.id)
        .maybeSingle();
      profile = data;
    }catch(e){}

    const email = String(current?.email || profile?.email || '').trim().toLowerCase();
    const username = String(profile?.username || current?.user_metadata?.username || '').trim().toLowerCase();
    const allowed = email === 'xflight1125@gmail.com' || username === 'metazoo king';

    document.body.classList.toggle('user-is-admin', allowed);
    links.forEach(link => {
      link.style.display = allowed ? '' : 'none';
    });
  }

  async function setAuthAwareNav(){
    const messageLinks = document.querySelectorAll('.chat-bell-link, .auth-only-link[href="messages.html"]');

    function hideMessages(){
      document.body.classList.remove('user-logged-in');
      messageLinks.forEach(el => {
        el.classList.add('auth-only-link');
        el.style.display = 'none';
        el.classList.remove('has-unread');
      });
      document.querySelectorAll('.chat-bell-count').forEach(badge => {
        badge.textContent = '';
        badge.classList.remove('show');
      });
      document.querySelectorAll('a[href="auth.html"]').forEach(a => {
        if(a.textContent.trim() === 'My Account') a.textContent = 'Account';
      });
    }

    function showMessages(){
      document.body.classList.add('user-logged-in');
      messageLinks.forEach(el => {
        el.classList.add('auth-only-link');
        el.style.display = '';
      });
      document.querySelectorAll('a[href="auth.html"]').forEach(a => {
        const label = a.textContent.trim();
        if(label === 'Account' || label === 'Login') a.textContent = 'My Account';
      });
    }

    const client = sb();
    if(!client){
      hideMessages();
      return null;
    }

    const current = await user(client);
    if(current){
      showMessages();
      return current;
    }

    hideMessages();
    return null;
  }


  function escapeHtml(text){
    return String(text || '').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[m]));
  }

  function timeLabel(value){
    try{ return new Date(value).toLocaleString(); }catch(e){ return ''; }
  }

  async function getUnreadCount(client, currentUser){
    const { data, error } = await client
      .from('conversation_members')
      .select('conversation_id,last_read_at,conversations(last_message_at)')
      .eq('user_id', currentUser.id);

    if(error || !data) return 0;

    let count = 0;
    data.forEach(row => {
      const lastMsg = row.conversations?.last_message_at ? new Date(row.conversations.last_message_at).getTime() : 0;
      const lastRead = row.last_read_at ? new Date(row.last_read_at).getTime() : 0;
      if(lastMsg && lastMsg > lastRead) count++;
    });
    return count;
  }


  async function updateBell(){
    const badges = document.querySelectorAll('.chat-bell-count');
    const links = document.querySelectorAll('.chat-bell-link');

    const client = sb();
    if(!client){
      badges.forEach(badge => badge.classList.remove('show'));
      links.forEach(link => link.classList.remove('has-unread'));
      return;
    }

    const current = await user(client);
    if(!current){
      document.body.classList.remove('user-logged-in');
      badges.forEach(badge => {
        badge.textContent = '';
        badge.classList.remove('show');
      });
      links.forEach(link => link.classList.remove('has-unread'));
      return;
    }

    document.body.classList.add('user-logged-in');

    const count = await getUnreadCount(client, current);
    badges.forEach(badge => {
      if(count > 0){
        badge.textContent = count > 9 ? '9+' : String(count);
        badge.classList.add('show');
      }else{
        badge.textContent = '';
        badge.classList.remove('show');
      }
    });

    links.forEach(link => link.classList.toggle('has-unread', count > 0));
  }


  async function getAdminId(client){
    const { data, error } = await client
      .from('profiles')
      .select('id,username')
      .eq('is_admin', true)
      .limit(1)
      .maybeSingle();
    if(error || !data) return null;
    return data.id;
  }

  async function createConversation(client, currentUser, targetUserId, bountySlug, bountyTitle, firstMessage){
    const { data: convo, error: convoErr } = await client
      .from('conversations')
      .insert({
        created_by: currentUser.id,
        bounty_slug: bountySlug || null,
        bounty_title: bountyTitle || 'Bounty Conversation',
        status: 'open'
      })
      .select()
      .single();

    if(convoErr) throw convoErr;

    const members = [
      { conversation_id: convo.id, user_id: currentUser.id, role: 'sender', last_read_at: new Date().toISOString() },
      { conversation_id: convo.id, user_id: targetUserId, role: 'recipient', last_read_at: null }
    ];

    const { error: memberErr } = await client.from('conversation_members').insert(members);
    if(memberErr) throw memberErr;

    const { error: msgErr } = await client.from('messages').insert({
      conversation_id: convo.id,
      sender_id: currentUser.id,
      body: firstMessage
    });
    if(msgErr) throw msgErr;

    return convo.id;
  }

  async function initStartMessage(){
    const form = qs('#startMessageForm');
    if(!form) return;

    const client = sb();
    if(!client){
      setStatus('startMessageStatus', 'Supabase is not configured yet.', 'error');
      return;
    }

    const current = await user(client);
    if(!current){
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = 'auth.html?return=' + returnUrl;
      return;
    }

    const p = params();
    const slug = p.get('bounty') || 'site-bounty';
    const title = p.get('title') || 'Bounty Conversation';
    const owner = p.get('owner');

    qs('#messageBountyTitle').textContent = title;
    form.bounty_slug.value = slug;
    form.bounty_title.value = title;

    form.addEventListener('submit', async (event)=>{
      event.preventDefault();
      setStatus('startMessageStatus', 'Starting conversation...', 'info');

      try{
        let targetId = owner;
        if(!targetId || targetId === 'admin'){
          targetId = await getAdminId(client);
        }
        if(!targetId){
          setStatus('startMessageStatus', 'No admin recipient found yet. Make your account admin first.', 'error');
          return;
        }
        if(targetId === current.id){
          setStatus('startMessageStatus', 'This bounty belongs to you. You cannot message yourself about it.', 'error');
          return;
        }

        const convoId = await createConversation(
          client,
          current,
          targetId,
          form.bounty_slug.value,
          form.bounty_title.value,
          form.message.value.trim()
        );

        window.location.href = 'conversation.html?id=' + encodeURIComponent(convoId);
      }catch(e){
        setStatus('startMessageStatus', e.message || 'Could not start conversation.', 'error');
      }
    });
  }

  async function initInbox(){
    const list = qs('#conversationList');
    if(!list) return;

    const client = sb();
    if(!client){
      list.innerHTML = '<div class="chat-status error">Supabase is not configured yet.</div>';
      return;
    }

    const current = await user(client);
    if(!current){
      window.location.href = 'auth.html?return=messages.html';
      return;
    }

    async function load(){
      const { data, error } = await client
        .from('conversation_members')
        .select('last_read_at,conversations(id,bounty_title,bounty_slug,last_message_at,created_at,status)')
        .eq('user_id', current.id)
        .order('last_message_at', { referencedTable:'conversations', ascending:false });

      if(error){
        list.innerHTML = `<div class="chat-status error">${escapeHtml(error.message)}</div>`;
        return;
      }

      if(!data || !data.length){
        list.innerHTML = '<div class="chat-status info">No messages yet. When someone responds to a bounty, conversations appear here.</div>';
        return;
      }

      list.innerHTML = data.map(row => {
        const c = row.conversations;
        const lastMsg = c?.last_message_at ? new Date(c.last_message_at).getTime() : 0;
        const lastRead = row.last_read_at ? new Date(row.last_read_at).getTime() : 0;
        const unread = lastMsg && lastMsg > lastRead;
        return `<a class="conversation-item" href="conversation.html?id=${c.id}">
          <strong>${unread ? '<span class="unread-dot"></span>' : ''}${escapeHtml(c.bounty_title || 'Conversation')}</strong>
          <small>${escapeHtml(c.bounty_slug || 'general')} • ${timeLabel(c.last_message_at || c.created_at)}</small>
        </a>`;
      }).join('');
    }

    await load();

    client.channel('inbox-' + current.id)
      .on('postgres_changes', { event:'*', schema:'public', table:'messages' }, () => { load(); updateBell(); })
      .subscribe();
  }

  async function initConversation(){
    const thread = qs('#messageThread');
    const form = qs('#messageComposer');
    if(!thread || !form) return;

    const client = sb();
    if(!client){
      thread.innerHTML = '<div class="chat-status error">Supabase is not configured yet.</div>';
      return;
    }

    const current = await user(client);
    if(!current){
      window.location.href = 'auth.html?return=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }

    const convoId = params().get('id');
    if(!convoId){
      thread.innerHTML = '<div class="chat-status error">Missing conversation ID.</div>';
      return;
    }

    async function markRead(){
      await client
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', convoId)
        .eq('user_id', current.id);
      updateBell();
    }

    async function load(){
      const { data: convo } = await client
        .from('conversations')
        .select('*')
        .eq('id', convoId)
        .maybeSingle();

      if(convo){
        qs('#conversationTitle').textContent = convo.bounty_title || 'Conversation';
        qs('#conversationMeta').textContent = convo.bounty_slug ? ('Bounty: ' + convo.bounty_slug) : 'General conversation';
      }

      const { data, error } = await client
        .from('messages')
        .select('*,profiles(username)')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending:true });

      if(error){
        thread.innerHTML = `<div class="chat-status error">${escapeHtml(error.message)}</div>`;
        return;
      }

      thread.innerHTML = (data || []).map(msg => {
        const mine = msg.sender_id === current.id;
        return `<div class="message-bubble ${mine ? 'mine' : ''}">
          <div class="meta">${escapeHtml(msg.profiles?.username || (mine ? 'You' : 'Collector'))} • ${timeLabel(msg.created_at)}</div>
          <div>${escapeHtml(msg.body)}</div>
        </div>`;
      }).join('');

      thread.scrollTop = thread.scrollHeight;
      await markRead();
    }

    form.addEventListener('submit', async (event)=>{
      event.preventDefault();
      const body = form.body.value.trim();
      if(!body) return;

      const btn = form.querySelector('button[type="submit"]');
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending...';

      const { error } = await client.from('messages').insert({
        conversation_id: convoId,
        sender_id: current.id,
        body
      });

      btn.disabled = false;
      btn.textContent = old;

      if(error){
        setStatus('conversationStatus', error.message, 'error');
        return;
      }

      form.reset();
      await load();
    });

    qs('#reportConversationBtn')?.addEventListener('click', async ()=>{
      const reason = window.prompt('Why are you reporting this conversation?');
      if(!reason) return;
      const { error } = await client.from('message_reports').insert({
        conversation_id: convoId,
        reporter_id: current.id,
        reason
      });
      if(error) setStatus('conversationStatus', error.message, 'error');
      else setStatus('conversationStatus', 'Report submitted for review.', 'success');
    });

    await load();

    client.channel('conversation-' + convoId)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:'conversation_id=eq.' + convoId }, load)
      .subscribe();
  }

  function wireBountyMessageButtons(){
    document.querySelectorAll('.bounty-response-btn').forEach(btn => {
      if(btn.dataset.chatWired === 'yes') return;
      btn.dataset.chatWired = 'yes';

      btn.addEventListener('click', () => {
        const card = btn.closest('[id]');
        const slug = btn.dataset.bountySlug || card?.id || 'site-bounty';
        const title = btn.dataset.bountyTitle ||
          card?.querySelector('h1,h2,h3,strong')?.textContent?.trim() ||
          'Bounty Conversation';
        const owner = btn.dataset.owner || 'admin';

        window.location.href = 'messages.html?bounty=' + encodeURIComponent(slug) +
          '&title=' + encodeURIComponent(title) +
          '&owner=' + encodeURIComponent(owner);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const client = sb();

    await setAuthAwareNav();
    await updateBell();
    const currentAdminNav = client ? await user(client) : null;
    await updatePrivateAdminNav(client, currentAdminNav);

    if(client){
      client.auth.onAuthStateChange(async () => {
        await setAuthAwareNav();
        await updateBell();
        await updatePrivateAdminNav(client, session?.user || null);
      });

      const current = await user(client);
      if(current){
        client.channel('unread-bell-' + current.id)
          .on('postgres_changes', { event:'*', schema:'public', table:'messages' }, () => updateBell())
          .on('postgres_changes', { event:'*', schema:'public', table:'conversation_members' }, () => updateBell())
          .subscribe();
      }
    }

    
    // Final guard: visitors must always see Account/Login, never Messages.
    document.querySelectorAll('a[href="auth.html"]').forEach(a => {
      a.classList.add('account-link');
      a.classList.remove('auth-only-link');
      a.style.display = '';
    });

    wireBountyMessageButtons();
    initStartMessage();
    initInbox();
    initConversation();
  });
})();
