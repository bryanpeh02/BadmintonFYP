import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api/apiConfig';

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [expandedEvents, setExpandedEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('hub');

  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [systemSettings, setSystemSettings] = useState({ lateCancelHours: 3, maxViolations: 3 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [slotsRequested, setSlotsRequested] = useState(1);
  const [guestNames, setGuestNames] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState(null);
  const [cancelSlotsCount, setCancelSlotsCount] = useState(1);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [pwdData, setPwdData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [waSettings, setWaSettings] = useState({ alerts: true, reminders: true });

  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { navigate('/'); return; }
    try {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      fetchData(user.userId || user.id);
    } catch (err) { navigate('/'); }
  }, [navigate]);

  const fetchData = async (userId) => {
    setLoading(true);
    try {
      const [eventsRes, userRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/events`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/users/${userId}`).catch(() => ({ data: null })),
        axios.get(`${API_BASE_URL}/settings`).catch(() => ({ data: { lateCancelHours: 3, maxViolations: 3 } }))
      ]);
      setEvents(eventsRes.data || []);
      setUserData(userRes.data);
      setSystemSettings(settingsRes.data);
    } catch (err) { setError('System offline. Please check your connection.'); }
    finally { setLoading(false); }
  };

  const toggleExpand = (eventId) => {
    setExpandedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };

  const openBookingModal = (event) => {
    setSelectedEvent(event);
    setSlotsRequested(1);
    setGuestNames([]);
    setIsModalOpen(true);
  };

  const handleSlotsChange = (newSlots) => {
    setSlotsRequested(newSlots);
    const guestsCount = Math.max(0, newSlots - 1);
    setGuestNames(prev => {
      const newArr = [...prev];
      while (newArr.length < guestsCount) newArr.push('');
      return newArr.slice(0, guestsCount);
    });
  };

  const updateGuestName = (index, value) => {
    const newArr = [...guestNames];
    newArr[index] = value;
    setGuestNames(newArr);
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    try {
      const finalGuestNames = slotsRequested > 1 ? guestNames.filter(n => n.trim() !== '').join(', ') : null;

      await axios.post(`${API_BASE_URL}/bookings`, {
        userId: currentUser.userId || currentUser.id,
        eventId: selectedEvent.eventId,
        slotsRequested: parseInt(slotsRequested),
        guestNames: finalGuestNames
      });
      setIsModalOpen(false);
      fetchData(currentUser.userId || currentUser.id);
    } catch (err) { alert(err.response?.data?.message || 'Failed to process booking.'); }
    finally { setBookingLoading(false); }
  };

  const openCancelModal = (booking) => { setReservationToCancel(booking); setCancelSlotsCount(1); setIsCancelModalOpen(true); };

  const submitCancel = async () => {
    setCancelLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/bookings/cancel`, { reservationId: reservationToCancel.reservation.reservationId, userId: currentUser.userId || currentUser.id, slotsToCancel: parseInt(cancelSlotsCount) });
      setIsCancelModalOpen(false);
      fetchData(currentUser.userId || currentUser.id);
    } catch (err) { alert(err.response?.data?.message || 'Failed to cancel.'); }
    finally { setCancelLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });
    if (pwdData.newPassword !== pwdData.confirmPassword) return setPwdMsg({ type: 'error', text: 'New passwords do not match!' });
    try {
      await axios.put(`${API_BASE_URL}/users/${currentUser.userId || currentUser.id}/change-password`, { oldPassword: pwdData.oldPassword, newPassword: pwdData.newPassword });
      setPwdMsg({ type: 'success', text: 'Password updated successfully!' });
      setPwdData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { setPwdMsg({ type: 'error', text: err.response?.data?.message || 'Incorrect old password.' }); }
  };

  const now = new Date();

  // 💡 修复：允许 Open 和 Full 的比赛显示，只要时间还没到！
  const openEvents = (events || []).filter(e => {
    const isStatusValid = e.status === 'Open' || e.status === 'Full';
    const isFuture = new Date(e.eventDate) >= now;
    return isStatusValid && isFuture;
  }).sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

  const currentUserId = String(currentUser?.userId || currentUser?.id);
  const allMyBookings = [];
  (events || []).forEach(e => {
    if (e && e.reservations && Array.isArray(e.reservations)) {
      const myResList = e.reservations.filter(r => String(r.userId) === currentUserId && (r.status === 'Active' || r.status === 'Waiting'));
      myResList.forEach(myRes => { allMyBookings.push({ event: e, reservation: myRes }); });
    }
  });

  const upcomingBookings = allMyBookings.filter(b => (new Date(b.event.eventDate).getTime() + 2 * 60 * 60 * 1000) >= now.getTime()).sort((a, b) => new Date(a.event.eventDate) - new Date(b.event.eventDate));

  const renderTabContent = () => {
    if (loading) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin rounded-full h-14 w-14 border-t-4 border-blue-600"></div></div>;
    if (error) return <div className="text-center mt-20 text-red-600 font-bold bg-red-50 p-6 rounded-2xl border border-red-100">{error}</div>;

    switch (activeTab) {
      case 'hub':
        return (
          <div className="space-y-6 animate-fade-in pb-24 md:pb-0">
            <header className="mb-8"><h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Play <span className="text-blue-600">Now</span></h1><p className="text-slate-500 mt-2 font-medium">Find your next badminton session.</p></header>
            {openEvents.length === 0 ? <div className="text-center bg-white p-12 rounded-3xl border border-slate-100 shadow-sm"><span className="text-6xl">🏸</span><h3 className="text-2xl font-bold text-slate-800 mt-6">No games scheduled</h3></div> :
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {openEvents.map(event => {
                  const isFull = event.availableSlots <= 0;
                  const fillPercentage = Math.min(100, Math.max(0, Math.round((((event.totalSlots || 1) - event.availableSlots) / (event.totalSlots || 1)) * 100)));
                  return (
                    <div key={event.eventId} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full overflow-hidden group">
                      <div className="p-6 md:p-8 flex-1">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{event.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${isFull ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{isFull ? 'Waitlist' : 'Open'}</span>
                        </div>
                        <div className="mb-6">
                          <p
                            className={`text-sm text-slate-500 whitespace-pre-wrap break-words transition-all duration-300 ${!expandedEvents.includes(event.eventId) && (event.description?.length > 100 || event.description?.includes('\n')) ? 'line-clamp-3' : ''}`}
                          >
                            {event.description || 'Join us for a great game!'}
                          </p>
                          {(event.description?.length > 100 || event.description?.includes('\n')) && (
                            <button
                              onClick={() => toggleExpand(event.eventId)}
                              className="text-blue-600 font-bold text-xs mt-1 hover:underline focus:outline-none"
                            >
                              {expandedEvents.includes(event.eventId) ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                        <div className="space-y-3 mb-6 bg-slate-50 p-5 rounded-2xl"><div className="flex items-center text-sm font-semibold text-slate-700"><span className="w-8 text-lg text-blue-500">📅</span> {new Date(event.eventDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div><div className="flex items-center text-sm font-semibold text-slate-700"><span className="w-8 text-lg text-blue-500">⏰</span> {new Date(event.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>
                        <div className="space-y-2"><div className="flex justify-between text-xs font-bold"><span className="text-slate-400 uppercase tracking-wider">Capacity</span><span className={isFull ? 'text-orange-500' : 'text-blue-600'}>{event.availableSlots} / {event.totalSlots} Slots Left</span></div><div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${isFull ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${fillPercentage}%` }}></div></div></div>
                      </div>
                      <button onClick={() => openBookingModal(event)} className={`w-full py-5 font-bold text-white text-sm transition ${isFull ? 'bg-slate-800 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{isFull ? 'Join Waitlist' : 'Book Slots'}</button>
                    </div>
                  );
                })}
              </div>}
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-6 animate-fade-in pb-24 md:pb-0">
            <header className="mb-8 border-b border-gray-800/10 pb-4"><h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">My <span className="text-blue-600">Schedule</span></h1><p className="text-slate-500 mt-2 font-medium">Manage your upcoming games.</p></header>
            {upcomingBookings.length === 0 ? <div className="text-center bg-white p-12 rounded-3xl border border-slate-100 shadow-sm"><span className="text-6xl">📅</span><h3 className="text-2xl font-bold text-slate-800 mt-6">Nothing planned yet</h3></div> :
              <div className="space-y-4">
                {upcomingBookings.map(b => {
                  const isWaiting = b.reservation.status === 'Waiting';
                  return (
                    <div key={b.reservation.reservationId} className="relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-2 ${isWaiting ? 'bg-orange-400' : 'bg-green-400'}`}></div>
                      <div className="pl-4 flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2"><h3 className="text-xl font-bold text-slate-900">{b.event.title}</h3><span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${isWaiting ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'}`}>{isWaiting ? `Waitlist #${b.reservation.queuePosition}` : 'Confirmed'}</span></div>
                        <p className="text-sm text-slate-500 font-medium mb-4 flex items-center gap-2"><span className="text-lg">🕒</span> {new Date(b.event.eventDate).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                          <span className="bg-slate-50 px-4 py-2 rounded-xl text-slate-600 border border-slate-100">Slots Held: <span className="text-blue-600 text-sm ml-1">{b.reservation.slotsCount}</span></span>
                          {!isWaiting && (b.reservation.isPaid ? <span className="px-4 py-2 rounded-xl bg-green-50 text-green-600 border border-green-100 flex items-center gap-1 cursor-default">💰 Paid</span> : <button onClick={() => setShowPaymentModal(true)} className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 flex items-center gap-1 shadow-sm transition active:scale-95">❌ Unpaid <span className="underline ml-1">Pay Now</span></button>)}
                        </div>
                      </div>
                      <button onClick={() => openCancelModal(b)} className="w-full md:w-auto px-8 py-3.5 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-full font-bold text-sm transition duration-200">Cancel Booking</button>
                    </div>
                  );
                })}
              </div>}
          </div>
        );

      case 'profile':
        const safeUserData = userData || currentUser || {};
        const currentViolations = safeUserData.violationCount || 0;
        const maxVio = systemSettings.maxViolations || 3;

        return (
          <div className="space-y-6 animate-fade-in pb-24 md:pb-0 max-w-2xl mx-auto">
            <header className="mb-8 border-b border-gray-800/10 pb-4 text-center md:text-left"><h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Player <span className="text-blue-600">Profile</span></h1><p className="text-slate-500 mt-2 font-medium">Manage your account and reputation.</p></header>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
              {safeUserData.isMonthlyMember && <div className="absolute top-5 right-5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-black text-[10px] px-4 py-1.5 rounded-full shadow-md tracking-widest uppercase">VIP Member</div>}
              <div className="flex flex-col md:flex-row items-center gap-6 relative z-10"><div className="w-24 h-24 rounded-full bg-blue-50 border-4 border-blue-100 flex items-center justify-center text-4xl shadow-inner">😎</div><div className="text-center md:text-left"><h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{safeUserData.username || 'Player'}</h2><p className="text-slate-500 font-mono mt-1 font-medium">{safeUserData.phone || 'No Contact'}</p></div></div>

              <div className="mt-8 pt-6 border-t border-slate-100 relative z-10">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="font-bold text-slate-600 text-sm">Violation Strikes</h3>
                  <span className={`font-black text-xl ${currentViolations >= maxVio ? 'text-red-500' : currentViolations > 0 ? 'text-orange-500' : 'text-slate-400'}`}>{currentViolations} <span className="text-sm font-medium text-slate-400">/ {maxVio}</span></span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex"><div className={`h-full rounded-full transition-all duration-1000 ${currentViolations >= maxVio ? 'bg-red-500' : currentViolations > 0 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${Math.max(5, (currentViolations / maxVio) * 100)}%` }}></div></div>
                <p className="text-xs text-slate-400 mt-3 font-medium text-center md:text-left">Late cancellations add strikes. Reaching the limit will restrict booking access.</p>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><span>🔒</span> Security & Notifications</h3>
              <div className="space-y-4 mb-8 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between"><div><p className="font-bold text-slate-800 text-sm">Waitlist Alerts</p><p className="text-[10px] text-slate-500 mt-0.5">WhatsApp ping when you secure a slot.</p></div><button onClick={() => setWaSettings({ ...waSettings, alerts: !waSettings.alerts })} className={`w-12 h-6 rounded-full transition-colors relative ${waSettings.alerts ? 'bg-green-500' : 'bg-slate-300'}`}><div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${waSettings.alerts ? 'translate-x-6' : 'translate-x-1'}`}></div></button></div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex items-center justify-between"><div><p className="font-bold text-slate-800 text-sm">Payment Reminders</p><p className="text-[10px] text-slate-500 mt-0.5">Automated gentle nudges from admin.</p></div><button onClick={() => setWaSettings({ ...waSettings, reminders: !waSettings.reminders })} className={`w-12 h-6 rounded-full transition-colors relative ${waSettings.reminders ? 'bg-green-500' : 'bg-slate-300'}`}><div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${waSettings.reminders ? 'translate-x-6' : 'translate-x-1'}`}></div></button></div>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div><label className="block text-slate-600 text-xs font-bold uppercase tracking-wider mb-2">Current Password</label><input required type="password" value={pwdData.oldPassword} onChange={e => setPwdData({ ...pwdData, oldPassword: e.target.value })} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition" placeholder="••••••••" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="block text-slate-600 text-xs font-bold uppercase tracking-wider mb-2">New Password</label><input required type="password" value={pwdData.newPassword} onChange={e => setPwdData({ ...pwdData, newPassword: e.target.value })} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition" placeholder="••••••••" /></div><div><label className="block text-slate-600 text-xs font-bold uppercase tracking-wider mb-2">Confirm New</label><input required type="password" value={pwdData.confirmPassword} onChange={e => setPwdData({ ...pwdData, confirmPassword: e.target.value })} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition" placeholder="••••••••" /></div></div>
                {pwdMsg.text && <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-3 ${pwdMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}><span className="text-xl">{pwdMsg.type === 'error' ? '⚠️' : '✅'}</span> {pwdMsg.text}</div>}
                <div className="pt-2"><button type="submit" className="w-full md:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-full font-bold transition shadow-md">Update Password</button></div>
              </form>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col md:flex-row relative">
      <aside className="hidden md:flex w-72 bg-white border-r border-slate-200 flex-col shadow-sm z-10 sticky top-0 h-screen"><div className="p-8 border-b border-slate-100 flex items-center gap-3"><span className="text-4xl">🏸</span><div><h2 className="text-2xl font-black tracking-tight text-slate-900">BHub</h2></div></div><nav className="flex-1 p-6 space-y-2"><button onClick={() => setActiveTab('hub')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left font-bold transition ${activeTab === 'hub' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}><span className="text-2xl">🔥</span> Lobby</button><button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left font-bold transition relative ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}><span className="text-2xl">📅</span> Schedule</button><button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left font-bold transition ${activeTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}><span className="text-2xl">👤</span> Profile</button></nav><div className="p-6 border-t border-slate-100 space-y-4">{(currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin') && <button onClick={() => navigate('/admin')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold border border-slate-200 transition text-sm shadow-sm">🛡️ Go to Admin</button>}<button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold transition text-sm">🚪 Logout</button></div></aside>
      <main className="flex-1 p-4 md:p-10 min-h-screen overflow-y-auto custom-scrollbar"><div className="max-w-5xl mx-auto h-full"><div className="md:hidden flex justify-between items-center py-2 mb-6 border-b border-slate-200"><div className="flex items-center gap-2"><span className="text-2xl">🏸</span><h2 className="text-xl font-black text-slate-900 tracking-tight">BHub</h2></div>{(currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin') && <button onClick={() => navigate('/admin')} className="text-[10px] font-bold uppercase tracking-widest bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 shadow-sm">Admin</button>}</div>{renderTabContent()}</div></main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-around items-center px-2 py-2 z-50 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]"><button onClick={() => setActiveTab('hub')} className={`flex flex-col items-center flex-1 py-2 transition-all duration-300 ${activeTab === 'hub' ? 'text-blue-600' : 'text-slate-400'}`}><span className="text-2xl mb-0.5">🔥</span><span className="text-[10px] font-bold">Lobby</span></button><button onClick={() => setActiveTab('schedule')} className={`relative flex flex-col items-center flex-1 py-2 transition-all duration-300 ${activeTab === 'schedule' ? 'text-blue-600' : 'text-slate-400'}`}><span className="text-2xl mb-0.5">📅</span><span className="text-[10px] font-bold">Schedule</span></button><button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center flex-1 py-2 transition-all duration-300 ${activeTab === 'profile' ? 'text-blue-600' : 'text-slate-400'}`}><span className="text-2xl mb-0.5">👤</span><span className="text-[10px] font-bold">Profile</span></button></nav>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex justify-center items-end md:items-center z-50 p-0 md:p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-6 md:p-8 rounded-t-3xl md:rounded-[2rem] w-full max-w-sm shadow-2xl relative animate-slide-up md:animate-none border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition font-bold">&times;</button>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Join Game</h2><p className="text-blue-600 font-bold mb-6 truncate text-sm">{selectedEvent?.title}</p>

            <form onSubmit={handleBookSubmit} className="space-y-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-4 text-center">How many slots?</label>
                <div className="flex items-center justify-between bg-white rounded-xl p-2 border border-slate-200 shadow-sm">
                  <button type="button" onClick={() => handleSlotsChange(Math.max(1, slotsRequested - 1))} className="w-12 h-12 rounded-lg bg-slate-100 text-slate-600 font-black text-xl hover:bg-slate-200 transition active:scale-95">-</button>
                  <span className="text-3xl font-black text-slate-900">{slotsRequested}</span>
                  <button type="button" onClick={() => handleSlotsChange(Math.min(10, slotsRequested + 1))} className="w-12 h-12 rounded-lg bg-slate-100 text-slate-600 font-black text-xl hover:bg-slate-200 transition active:scale-95">+</button>
                </div>
              </div>

              {/* 💡 智能循环渲染多个输入框 */}
              {slotsRequested > 1 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-fade-in space-y-3">
                  <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Who is coming with you?</label>
                  {guestNames.map((name, index) => (
                    <input
                      key={index}
                      type="text"
                      value={name}
                      onChange={e => updateGuestName(index, e.target.value)}
                      placeholder={`Guest #${index + 1} Name`}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition"
                    />
                  ))}
                </div>
              )}

              {selectedEvent?.availableSlots <= 0 ? <div className="text-[10px] text-orange-600 font-bold text-center bg-orange-50 p-3 rounded-xl uppercase tracking-widest border border-orange-100">Event full. You will be waitlisted.</div> : null}
              <button type="submit" disabled={bookingLoading} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-base shadow-lg shadow-blue-500/30 transition disabled:opacity-50 mt-2 mb-4 md:mb-0">{bookingLoading ? 'Processing...' : 'Confirm Booking'}</button>
            </form>
          </div>
        </div>
      )}

      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex justify-center items-end md:items-center z-50 p-0 md:p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-6 md:p-8 rounded-t-3xl md:rounded-[2rem] w-full max-w-sm shadow-2xl relative animate-slide-up md:animate-none border border-slate-100">
            <button onClick={() => setIsCancelModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition font-bold">&times;</button>
            <h2 className="text-2xl font-black text-red-600 mb-1">Cancel Booking</h2>
            <p className="text-slate-500 font-medium mb-6 text-sm mt-2">You hold <span className="font-bold text-slate-900">{reservationToCancel?.reservation?.slotsCount}</span> slots.</p>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6"><label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-4 text-center">Slots to cancel</label><div className="flex items-center justify-between bg-white rounded-xl p-2 border border-slate-200 shadow-sm"><button type="button" onClick={() => setCancelSlotsCount(Math.max(1, cancelSlotsCount - 1))} className="w-12 h-12 rounded-lg bg-slate-100 text-slate-600 font-black text-xl hover:bg-slate-200 transition active:scale-95">-</button><span className="text-3xl font-black text-slate-900">{cancelSlotsCount}</span><button type="button" onClick={() => setCancelSlotsCount(Math.min(reservationToCancel?.reservation?.slotsCount || 1, cancelSlotsCount + 1))} className="w-12 h-12 rounded-lg bg-slate-100 text-slate-600 font-black text-xl hover:bg-slate-200 transition active:scale-95">+</button></div></div>
            <button onClick={submitCancel} disabled={cancelLoading} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-base shadow-lg shadow-red-500/30 transition disabled:opacity-50 mb-4 md:mb-0">{cancelLoading ? 'Processing...' : 'Confirm Cancellation'}</button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                .animate-fade-in { animation: fadeIn 0.2s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
            `}} />
    </div>
  );
};

export default Dashboard;
