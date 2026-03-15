import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api/apiConfig';

const AdminPanel = () => {
    const [users, setUsers] = useState([]);
    const [events, setEvents] = useState([]);
    const [systemSettings, setSystemSettings] = useState({ lateCancelHours: 3, maxViolations: 3 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [eventViewFilter, setEventViewFilter] = useState('Upcoming');

    // 💡 广播功能
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const [showUserModal, setShowUserModal] = useState(false);
    const [userFormData, setUserFormData] = useState({ userId: null, username: '', phone: '', role: 'Player', isMonthlyMember: false });
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventFormData, setEventFormData] = useState({ eventId: null, title: '', description: '', eventDate: '', totalSlots: 10, status: 'Open', availableSlots: 10, preSelectedMemberIds: [] });

    const [selectedRosterEvent, setSelectedRosterEvent] = useState(null);
    const [showEditBookingModal, setShowEditBookingModal] = useState(false);
    const [bookingFormData, setBookingFormData] = useState({ reservationId: null, slotsCount: 1, status: 'Active', userName: '' });

    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            if (user.role !== 'Admin' && user.role !== 'SuperAdmin') navigate('/dashboard');
        } else {
            navigate('/');
        }
        fetchData();
    }, [navigate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, eventsRes, settingsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/users`),
                axios.get(`${API_BASE_URL}/events`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/settings`).catch(() => ({ data: { lateCancelHours: 3, maxViolations: 3 } }))
            ]);
            setUsers(usersRes.data);

            const now = new Date();
            const processedEvents = (eventsRes.data || []).map(e => {
                if (new Date(e.eventDate) < now && (e.status === 'Open' || e.status === 'Full')) {
                    return { ...e, status: 'Completed' };
                }
                return e;
            });
            setEvents(processedEvents);
            setSystemSettings(settingsRes.data);
        } catch (err) { console.error('Failed to load data', err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (selectedRosterEvent) {
            const updatedEvent = events.find(e => e.eventId === selectedRosterEvent.eventId);
            if (updatedEvent) setSelectedRosterEvent(updatedEvent);
        }
    }, [events]);

    const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };
    const openRoster = (event) => setSelectedRosterEvent(event);
    const closeRoster = () => setSelectedRosterEvent(null);

    // 💡 广播功能逻辑
    const toggleUserSelection = (userId) => {
        setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
    };

    const handleSendBroadcast = async () => {
        if (!broadcastMsg.trim()) return alert("Please enter a message.");
        setIsBroadcasting(true);
        try {
            await axios.post(`${API_BASE_URL}/users/broadcast`, { userIds: selectedUserIds, message: broadcastMsg });
            alert(`✅ Message sent to ${selectedUserIds.length} players!`);
            setShowBroadcastModal(false);
            setBroadcastMsg('');
            setSelectedUserIds([]);
        } catch (err) { alert("❌ Broadcast failed: " + (err.response?.data?.message || err.message)); }
        finally { setIsBroadcasting(false); }
    };

    const openEditBooking = (reservation) => { setBookingFormData({ reservationId: reservation.reservationId, slotsCount: reservation.slotsCount, status: reservation.status, userName: reservation.user?.username || `User #${reservation.userId}` }); setShowEditBookingModal(true); };

    const handleUpdateBooking = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_BASE_URL}/bookings/${bookingFormData.reservationId}/admin?adminId=${currentUser?.userId || currentUser?.id}`, { slotsCount: parseInt(bookingFormData.slotsCount), status: bookingFormData.status });
            setShowEditBookingModal(false);
            fetchData();
        } catch (err) { alert('Error updating booking: ' + (err.response?.data?.message || err.message)); }
    };

    const handleRemoveBooking = async (reservationId, userName) => {
        if (!window.confirm(`FORCE REMOVE ${userName} from this event?`)) return;
        try { await axios.delete(`${API_BASE_URL}/bookings/${reservationId}/admin?adminId=${currentUser?.userId || currentUser?.id}`); fetchData(); }
        catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
    };

    const handleTogglePayment = async (reservationId, userName) => {
        try { await axios.put(`${API_BASE_URL}/bookings/${reservationId}/toggle-payment?adminId=${currentUser?.userId || currentUser?.id}`, {}); fetchData(); }
        catch (err) { alert('Error toggling payment: ' + (err.response?.data?.message || err.message)); }
    };

    const handleRemindPayment = async (reservationId, userName) => {
        if (!window.confirm(`Send WhatsApp payment reminder to ${userName}?`)) return;
        try {
            await axios.post(`${API_BASE_URL}/bookings/${reservationId}/remind-payment?adminId=${currentUser?.userId || currentUser?.id}`, {});
            alert(`✅ WhatsApp reminder successfully sent to ${userName}!`);
        } catch (err) { alert('❌ Failed to send WhatsApp: ' + (err.response?.data?.message || err.message)); }
    };

    const handlePenalize = async (userId, userName) => {
        if (!window.confirm(`Penalize ${userName}?`)) return;
        try { await axios.post(`${API_BASE_URL}/users/${userId}/penalize?adminId=${currentUser?.userId || currentUser?.id}`, {}); fetchData(); } catch (err) { alert('Error'); }
    };

    const handleUnfreeze = async (userId, userName) => {
        if (!window.confirm(`Unfreeze ${userName}?`)) return;
        try { await axios.post(`${API_BASE_URL}/users/${userId}/unfreeze?adminId=${currentUser?.userId || currentUser?.id}`, {}); fetchData(); } catch (err) { alert('Error'); }
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            let cleanPhone = userFormData.phone.replace(/^60/, '').replace(/^0/, '');
            const finalPhone = '60' + cleanPhone;
            const payload = { ...userFormData, phone: finalPhone };
            if (userFormData.userId) await axios.put(`${API_BASE_URL}/users/${userFormData.userId}?adminId=${currentUser?.userId || currentUser?.id}`, payload);
            else await axios.post(`${API_BASE_URL}/users?adminId=${currentUser?.userId || currentUser?.id}`, payload);
            setShowUserModal(false); fetchData();
        } catch (err) { alert('Error'); }
    };

    const handleDeleteUser = async (userId, userName) => {
        if (!window.confirm(`Delete ${userName}?`)) return;
        try { await axios.delete(`${API_BASE_URL}/users/${userId}?adminId=${currentUser?.userId || currentUser?.id}`); fetchData(); } catch (err) { alert('Error'); }
    };

    const handleResetPassword = async (userId, userName) => {
        if (!window.confirm(`Reset password for ${userName} to '123456'?`)) return;
        try { await axios.put(`${API_BASE_URL}/users/${userId}/reset-password?adminId=${currentUser?.userId || currentUser?.id}`, {}); alert(`Password reset.`); }
        catch (err) { alert('Error'); }
    };

    const openCreateUserModal = () => { setUserFormData({ userId: null, username: '', phone: '', role: 'Player', isMonthlyMember: false }); setShowUserModal(true); };
    const openEditUserModal = (user) => {
        const displayPhone = user.phone.startsWith('60') ? user.phone.slice(2) : user.phone;
        setUserFormData({ userId: user.userId, username: user.username, phone: displayPhone, role: user.role || 'Player', isMonthlyMember: user.isMonthlyMember || false });
        setShowUserModal(true);
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        try {
            const adminId = currentUser?.userId || currentUser?.id;

            // 💡 智能数学计算：自动推算真实的 Available Slots 和 Status
            let finalAvailableSlots = eventFormData.eventId ? parseInt(eventFormData.availableSlots, 10) : parseInt(eventFormData.totalSlots, 10);
            let finalStatus = eventFormData.status || 'Open';

            if (eventFormData.eventId) {
                // 找出修改前后的 Total Slots 差值
                const originalEvent = events.find(ev => ev.eventId === eventFormData.eventId);
                if (originalEvent) {
                    const slotDiff = parseInt(eventFormData.totalSlots, 10) - originalEvent.totalSlots;
                    finalAvailableSlots = originalEvent.availableSlots + slotDiff;

                    // 智能扭转状态：只要还有空位，强行变回 Open！如果扣成负数或 0，强行变 Full！
                    if (finalStatus === 'Open' || finalStatus === 'Full') {
                        finalStatus = finalAvailableSlots > 0 ? 'Open' : 'Full';
                    }
                }
            }

            const payload = {
                ...eventFormData,
                totalSlots: parseInt(eventFormData.totalSlots, 10),
                availableSlots: finalAvailableSlots,
                status: finalStatus,
                preSelectedMemberIds: eventFormData.preSelectedMemberIds
            };

            if (eventFormData.eventId) {
                await axios.put(`${API_BASE_URL}/events/${eventFormData.eventId}?adminId=${adminId}`, payload);
            } else {
                await axios.post(`${API_BASE_URL}/events?adminId=${adminId}`, payload);
            }

            setShowEventModal(false);
            fetchData();
        } catch (err) {
            alert(`Error: ${err.response?.data?.message || err.message}`);
        }
    };

    const handleDeleteEvent = async (eventId, title) => {
        if (!window.confirm(`Delete event "${title}"?`)) return;
        try { await axios.delete(`${API_BASE_URL}/events/${eventId}?adminId=${currentUser?.userId || currentUser?.id}`); fetchData(); } catch (err) { alert('Error'); }
    };

    const openCreateEventModal = () => { setEventFormData({ eventId: null, title: '', description: '', eventDate: '', totalSlots: 16, status: 'Open', availableSlots: 16, preSelectedMemberIds: [] }); setShowEventModal(true); };

    // 💡 时区大修复：完美保留本地时间
    const openEditEventModal = (event) => {
        const dateObj = new Date(event.eventDate);
        const tzOffsetMs = dateObj.getTimezoneOffset() * 60000;
        const localISOTime = new Date(dateObj.getTime() - tzOffsetMs).toISOString().slice(0, 16);

        setEventFormData({
            eventId: event.eventId,
            title: event.title,
            description: event.description,
            eventDate: localISOTime,
            totalSlots: event.totalSlots,
            status: event.status,
            availableSlots: event.availableSlots,
            preSelectedMemberIds: []
        });
        setShowEventModal(true);
    };

    const handleVipToggle = (userId) => {
        setEventFormData(prev => {
            const isSelected = prev.preSelectedMemberIds.includes(userId);
            if (isSelected) return { ...prev, preSelectedMemberIds: prev.preSelectedMemberIds.filter(id => id !== userId) };
            else return { ...prev, preSelectedMemberIds: [...prev.preSelectedMemberIds, userId] };
        });
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try { await axios.put(`${API_BASE_URL}/settings?adminId=${currentUser?.userId || currentUser?.id}`, systemSettings); alert("System Rules updated!"); fetchData(); }
        catch (err) { alert('Error'); }
    };

    const handleTabChange = (tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); };

    // ================= 💡 数据统计引擎 =================
    const now = new Date();

    const monthlyMembers = users.filter(u => u.isMonthlyMember && !u.isBlacklisted);
    const totalPlayers = users.filter(u => u.role !== 'Admin' && u.role !== 'SuperAdmin').length;
    const blacklistedUsers = users.filter(u => u.isBlacklisted).length;
    const totalUpcomingEvents = events.filter(e => new Date(e.eventDate) >= now && (e.status === 'Open' || e.status === 'Full')).length;

    let totalActiveBookings = 0; let pendingPaymentsCount = 0;

    events.forEach(e => {
        if (e.reservations) {
            const activeRes = e.reservations.filter(r => r.status === 'Active');
            totalActiveBookings += activeRes.reduce((sum, r) => sum + r.slotsCount, 0);
            pendingPaymentsCount += activeRes.filter(r => !r.isPaid).length;
        }
    });

    const recentFiveEvents = events
        .filter(e => new Date(e.eventDate) >= now && e.status !== 'Cancelled' && e.status !== 'Completed')
        .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
        .slice(0, 5);

    const chartData = recentFiveEvents.map(e => {
        const booked = e.reservations ? e.reservations.filter(r => r.status === 'Active').reduce((sum, r) => sum + r.slotsCount, 0) : 0;
        const waitlist = e.reservations ? e.reservations.filter(r => r.status === 'Waiting').reduce((sum, r) => sum + r.slotsCount, 0) : 0;
        const total = e.totalSlots;
        const fillRate = total > 0 ? Math.round((booked / total) * 100) : 0;
        return { name: e.title.length > 20 ? e.title.substring(0, 20) + '...' : e.title, Booked: booked, Waitlist: waitlist, Total: total, FillRate: fillRate };
    });

    const displayEvents = events.filter(e => {
        const isPast = new Date(e.eventDate) < now || e.status === 'Completed';
        return eventViewFilter === 'Upcoming' ? !isPast && e.status !== 'Cancelled' : isPast || e.status === 'Cancelled';
    }).sort((a, b) => eventViewFilter === 'Upcoming'
        ? new Date(a.eventDate) - new Date(b.eventDate)
        : new Date(b.eventDate) - new Date(a.eventDate)
    );

    const renderTabContent = () => {
        if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;

        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <header className="mb-6 pb-4 border-b border-gray-700 flex justify-between items-end">
                            <div><h1 className="text-2xl md:text-3xl font-extrabold text-white">System Insights</h1><p className="text-sm md:text-base text-gray-400 mt-1">High-level overview of the Badminton Hub platform.</p></div>
                            <div className={`px-4 py-2 rounded-lg font-bold border ${currentUser?.role === 'SuperAdmin' ? 'bg-purple-900/30 text-purple-400 border-purple-800/50' : 'bg-blue-900/30 text-blue-400 border-blue-800/50'}`}>
                                {currentUser?.role === 'SuperAdmin' ? '👑 Super Admin' : '🛡️ Admin'}
                            </div>
                        </header>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 md:p-6 rounded-2xl shadow-xl border border-gray-700"><p className="text-gray-400 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">Total Bookings</p><div className="flex items-end justify-between"><h3 className="text-3xl md:text-4xl font-black text-white">{totalActiveBookings}</h3><span className="text-blue-500 text-2xl md:text-3xl">🎫</span></div></div>
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 md:p-6 rounded-2xl shadow-xl border border-gray-700"><p className="text-gray-400 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">Upcoming Events</p><div className="flex items-end justify-between"><h3 className="text-3xl md:text-4xl font-black text-white">{totalUpcomingEvents}</h3><span className="text-green-500 text-2xl md:text-3xl">🏸</span></div></div>
                            <div className="bg-gradient-to-br from-orange-900/40 to-gray-900 p-5 md:p-6 rounded-2xl shadow-xl border border-orange-900/50"><p className="text-orange-400 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">Pending Payments</p><div className="flex items-end justify-between"><h3 className="text-3xl md:text-4xl font-black text-orange-100">{pendingPaymentsCount}</h3><span className="text-orange-500 text-2xl md:text-3xl">💸</span></div></div>
                            <div className="bg-gradient-to-br from-red-900/30 to-gray-900 p-5 md:p-6 rounded-2xl shadow-xl border border-red-900/50"><p className="text-red-400 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">Blacklisted Users</p><div className="flex items-end justify-between"><h3 className="text-3xl md:text-4xl font-black text-red-100">{blacklistedUsers}</h3><span className="text-red-500 text-2xl md:text-3xl">🛑</span></div></div>
                        </div>
                        <div className="mt-8 bg-gray-800 p-5 md:p-8 rounded-2xl border border-gray-700 shadow-xl">
                            <h3 className="text-lg md:text-xl font-bold text-white mb-6 border-b border-gray-700 pb-4">📊 Next 5 Events Fill Rate</h3>
                            <div className="space-y-6">
                                {chartData.length === 0 ? <div className="text-center text-gray-500 py-6">No events available yet.</div> : chartData.map((data, index) => (
                                    <div key={index} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-2">
                                            <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-gray-200">{data.name}</span><span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-800/50 whitespace-nowrap">{data.Booked} / {data.Total} Slots</span>{data.Waitlist > 0 && <span className="px-2 py-0.5 bg-orange-900/30 text-orange-400 text-xs rounded border border-orange-800/50 animate-pulse whitespace-nowrap">⏳ {data.Waitlist} Waiting</span>}</div>
                                            <span className={`text-sm font-black ${data.FillRate >= 100 ? 'text-red-400' : data.FillRate >= 80 ? 'text-green-400' : 'text-blue-400'}`}>{data.FillRate}% Full</span>
                                        </div>
                                        <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden flex"><div className={`h-full transition-all duration-1000 ${data.FillRate >= 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${data.FillRate}%` }}></div></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'events':
                return (
                    <div className="space-y-4 md:space-y-6 animate-fade-in flex flex-col h-full">
                        <header className="mb-2 md:mb-4 pb-4 border-b border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 flex-shrink-0">
                            <div><h1 className="text-2xl md:text-3xl font-extrabold text-white">Events Management</h1><p className="text-sm md:text-base text-gray-400 mt-1">Review and manage all events.</p></div>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="bg-gray-900 p-1 rounded-xl flex items-center border border-gray-700 w-full sm:w-auto">
                                    <button onClick={() => setEventViewFilter('Upcoming')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition ${eventViewFilter === 'Upcoming' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>Active</button>
                                    <button onClick={() => setEventViewFilter('Past')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition ${eventViewFilter === 'Past' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>History</button>
                                </div>
                                <button onClick={openCreateEventModal} className="hidden sm:block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition whitespace-nowrap">+ Create</button>
                            </div>
                        </header>
                        <button onClick={openCreateEventModal} className="sm:hidden w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition whitespace-nowrap">+ Create Event</button>

                        <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 overflow-hidden flex-1 max-h-[65vh] flex flex-col">
                            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead className="bg-gray-900 border-b border-gray-700 sticky top-0 z-10">
                                        <tr><th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wider">Event Details</th><th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wider">Date</th><th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wider">Capacity</th><th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wider">Status</th><th className="py-4 px-6 text-right text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wider">Actions</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {displayEvents.length === 0 ? <tr><td colSpan="5" className="text-center py-10 text-gray-500">No {eventViewFilter.toLowerCase()} events found.</td></tr> : displayEvents.map(event => {
                                            const waitlistCount = event.reservations ? event.reservations.filter(r => r.status === 'Waiting').reduce((sum, r) => sum + r.slotsCount, 0) : 0;
                                            return (
                                                <tr key={event.eventId} className={`hover:bg-gray-750 transition ${eventViewFilter === 'Past' ? 'opacity-60' : ''}`}>
                                                    <td className="py-4 px-6"><div className="font-bold text-white whitespace-nowrap">{event.title}</div><div className="text-xs md:text-sm text-gray-400 truncate max-w-[150px] md:max-w-xs">{event.description}</div></td>
                                                    <td className="py-4 px-6 text-sm text-gray-300 whitespace-nowrap">{new Date(event.eventDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                                    <td className="py-4 px-6 whitespace-nowrap"><div className="flex flex-col gap-1 items-start"><div><span className="text-white font-medium">{event.availableSlots}</span><span className="text-gray-500 text-xs md:text-sm"> / {event.totalSlots} Slots</span></div>{waitlistCount > 0 && <span className="inline-block px-2 py-0.5 bg-orange-900/40 text-orange-400 text-[10px] font-bold rounded border border-orange-800/50 w-max">⏳ {waitlistCount} Queue</span>}</div></td>
                                                    <td className="py-4 px-6 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-bold ${event.status === 'Open' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-gray-700 text-gray-400 border border-gray-600'}`}>{event.status}</span></td>
                                                    <td className="py-4 px-6 text-right space-x-2 text-sm whitespace-nowrap">
                                                        <button onClick={() => openRoster(event)} className="px-3 py-1.5 bg-yellow-900/50 text-yellow-400 border border-yellow-800 rounded font-semibold hover:bg-yellow-800 transition">🔍 Roster</button>
                                                        {eventViewFilter === 'Upcoming' && <button onClick={() => openEditEventModal(event)} className="px-3 py-1.5 bg-gray-700 text-blue-400 rounded font-semibold hover:bg-gray-600 transition">Edit</button>}
                                                        <button onClick={() => handleDeleteEvent(event.eventId, event.title)} className="px-3 py-1.5 bg-red-900/30 text-red-400 rounded font-semibold hover:bg-red-900/60 transition">Del</button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );

            case 'users':
                return (
                    <div className="space-y-4 md:space-y-6 animate-fade-in flex flex-col h-full">
                        <header className="mb-2 md:mb-4 pb-4 border-b border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 flex-shrink-0">
                            <div><h1 className="text-2xl md:text-3xl font-extrabold text-white">Player Management</h1><p className="text-sm md:text-base text-gray-400 mt-1">Monitor users and assign roles.</p></div>
                            <div className="flex gap-4">
                                {selectedUserIds.length > 0 && (
                                    <button onClick={() => setShowBroadcastModal(true)} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center gap-2 animate-bounce">
                                        <span>📢</span> Announce ({selectedUserIds.length})
                                    </button>
                                )}
                                <button onClick={openCreateUserModal} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition whitespace-nowrap">+ Add Player</button>
                            </div>
                        </header>

                        <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 overflow-hidden flex-1 max-h-[70vh] md:max-h-[65vh] flex flex-col">
                            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead className="bg-gray-900 border-b border-gray-700 sticky top-0 z-10">
                                        <tr>
                                            <th className="py-4 px-6 w-10">
                                                <input type="checkbox" onChange={(e) => e.target.checked ? setSelectedUserIds(users.map(u => u.userId)) : setSelectedUserIds([])} checked={selectedUserIds.length > 0 && selectedUserIds.length === users.length} className="w-5 h-5 rounded border-gray-600 text-blue-500 bg-gray-900 focus:ring-0" />
                                            </th>
                                            <th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase">Player Info</th><th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase">Role</th><th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase">Violations</th><th className="py-4 px-6 text-xs md:text-sm font-semibold text-gray-400 uppercase">Status</th><th className="py-4 px-6 text-right text-xs md:text-sm font-semibold text-gray-400 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {users.length === 0 ? <tr><td colSpan="6" className="text-center py-10 text-gray-500">No players found.</td></tr> : users.map((user) => {
                                            const isTargetHighLevel = user.role === 'Admin' || user.role === 'SuperAdmin';
                                            const canManage = currentUser?.role === 'SuperAdmin' || !isTargetHighLevel;
                                            return (
                                                <tr key={user.userId} className={`hover:bg-gray-750 transition ${selectedUserIds.includes(user.userId) ? 'bg-blue-900/10' : ''}`}>
                                                    <td className="py-4 px-6">
                                                        <input type="checkbox" checked={selectedUserIds.includes(user.userId)} onChange={() => toggleUserSelection(user.userId)} className="w-5 h-5 rounded border-gray-600 text-blue-500 bg-gray-900" />
                                                    </td>
                                                    <td className="py-4 px-6 whitespace-nowrap"><div className="flex items-center gap-2"><div className="font-bold text-white">{user.username}</div>{user.isMonthlyMember && <span className="px-2 py-0.5 bg-yellow-900/40 border border-yellow-700 text-yellow-500 text-[10px] font-extrabold uppercase rounded">🏅 VIP</span>}</div><div className="text-xs md:text-sm text-gray-400 mt-1">{user.phone}</div></td>
                                                    <td className="py-4 px-6 whitespace-nowrap"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${user.role === 'SuperAdmin' ? 'bg-purple-900 text-purple-200' : user.role === 'Admin' ? 'bg-blue-900 text-blue-200' : 'bg-gray-700 text-gray-300'}`}>{user.role || 'Player'}</span></td>
                                                    <td className="py-4 px-6 whitespace-nowrap"><div className="flex items-center gap-1"><span className={`font-bold ${user.violationCount >= systemSettings.maxViolations ? 'text-red-500' : user.violationCount > 0 ? 'text-orange-400' : 'text-green-500'}`}>{user.violationCount || 0}</span><span className="text-gray-500 text-xs md:text-sm">/ {systemSettings.maxViolations}</span></div></td>
                                                    <td className="py-4 px-6 whitespace-nowrap">{user.isBlacklisted ? <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-red-900/50 text-red-400 border border-red-800">🛑 Blacklisted</span> : <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-green-900/50 text-green-400 border border-green-800">✅ Active</span>}</td>
                                                    <td className="py-4 px-6 text-right whitespace-nowrap">
                                                        {canManage ? (
                                                            <div className="flex flex-col gap-2 w-full max-w-[150px] ml-auto">
                                                                <div className="flex gap-2 w-full"><button onClick={() => openEditUserModal(user)} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded shadow-sm text-xs font-semibold transition">Edit</button><button onClick={() => handleResetPassword(user.userId, user.username)} className="flex-1 py-1.5 bg-yellow-900/50 hover:bg-yellow-800 text-yellow-200 border border-yellow-900 rounded shadow-sm text-xs font-semibold transition">🔑 Pwd</button><button onClick={() => handleDeleteUser(user.userId, user.username)} className="flex-1 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-900 rounded shadow-sm text-xs font-semibold transition">Del</button></div>
                                                                <div className="flex gap-2 w-full">{!user.isBlacklisted ? <button onClick={() => handlePenalize(user.userId, user.username)} className="flex-1 py-1.5 bg-gray-800 border border-orange-900 text-orange-500 rounded hover:bg-orange-900/30 text-xs font-medium">Penalize</button> : <button disabled className="flex-1 py-1.5 bg-gray-800 border border-gray-700 text-gray-600 rounded cursor-not-allowed text-xs font-medium">Penalized</button>}<button onClick={() => handleUnfreeze(user.userId, user.username)} disabled={!user.isBlacklisted && (!user.violationCount || user.violationCount === 0)} className={`flex-1 py-1.5 rounded text-xs font-medium ${(!user.isBlacklisted && (!user.violationCount || user.violationCount === 0)) ? 'bg-gray-800 border border-gray-700 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border border-green-900 text-green-500 hover:bg-green-900/30'}`}>Unfreeze</button></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full max-w-[150px] ml-auto text-center py-2 bg-gray-800/50 border border-gray-700 rounded text-gray-500 text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed"><span>🔒</span> Restricted</div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );

            case 'settings':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <header className="mb-6 pb-4 border-b border-gray-700"><h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3"><span>⚙️</span> Rule Engine</h1><p className="text-sm md:text-base text-gray-400 mt-1">Configure automated penalties.</p></header>
                        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-5 md:p-8 max-w-3xl">
                            <form onSubmit={handleSaveSettings} className="space-y-8">
                                <div className="bg-gray-900/50 p-4 md:p-6 rounded-xl border border-gray-700">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-4"><div><h3 className="text-base md:text-lg font-bold text-blue-400">Late Cancellation Window</h3><p className="text-xs md:text-sm text-gray-500 mt-1">Cancel before this time to avoid penalty.</p></div><div className="text-2xl md:text-3xl font-black text-white bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-900/50 text-center w-full sm:w-auto">{systemSettings.lateCancelHours} <span className="text-sm md:text-base text-blue-400 font-bold">Hrs</span></div></div>
                                    <input type="range" min="1" max="48" step="1" value={systemSettings.lateCancelHours} onChange={(e) => setSystemSettings({ ...systemSettings, lateCancelHours: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                    <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-2 font-bold"><span>1 Hr</span><span>48 Hrs</span></div>
                                </div>
                                <div className="bg-gray-900/50 p-4 md:p-6 rounded-xl border border-gray-700">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-4"><div><h3 className="text-base md:text-lg font-bold text-red-400">Blacklist Threshold</h3><p className="text-xs md:text-sm text-gray-500 mt-1">Strikes before auto-blacklist.</p></div><div className="text-2xl md:text-3xl font-black text-white bg-red-900/30 px-4 py-2 rounded-lg border border-red-900/50 text-center w-full sm:w-auto">{systemSettings.maxViolations} <span className="text-sm md:text-base text-red-400 font-bold">Strikes</span></div></div>
                                    <input type="range" min="1" max="10" step="1" value={systemSettings.maxViolations} onChange={(e) => setSystemSettings({ ...systemSettings, maxViolations: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                                    <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-2 font-bold"><span>1 Strike</span><span>10 Strikes</span></div>
                                </div>
                                <div className="pt-4 border-t border-gray-700"><button type="submit" className="w-full py-3 md:py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-extrabold text-base md:text-lg transition shadow-lg shadow-green-900/50">💾 Apply Rules</button></div>
                            </form>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col md:flex-row font-sans text-gray-100 overflow-hidden relative">

            {/* 📱 Mobile Top Header */}
            <div className="md:hidden bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center z-20 flex-shrink-0 shadow-md">
                <div className="flex items-center gap-2"><span className="text-2xl">🛡️</span><h2 className="text-lg font-bold tracking-wide text-white">Admin Console</h2></div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-300 hover:text-white focus:outline-none p-1 rounded-md hover:bg-gray-700"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
            </div>
            {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>}

            {/* Desktop & Mobile Sidebar */}
            <aside className={`fixed inset-y-0 left-0 w-72 bg-gray-800 border-r border-gray-700 flex flex-col shadow-2xl z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-8 border-b border-gray-700 flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-3xl text-blue-500">🛡️</span><div><h2 className="text-xl font-bold tracking-wide text-white">Admin Console</h2><p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-semibold">Back-Office</p></div></div><button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
                <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
                    <button onClick={() => handleTabChange('dashboard')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-left font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-gray-700 text-gray-300'}`}><span className="text-xl">📊</span> Dashboard</button>
                    <button onClick={() => handleTabChange('events')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-left font-medium transition ${activeTab === 'events' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-gray-700 text-gray-300'}`}><span className="text-xl">🏸</span> Events</button>
                    <button onClick={() => handleTabChange('users')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-left font-medium transition ${activeTab === 'users' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-gray-700 text-gray-300'}`}><span className="text-xl">👥</span> Players</button>
                    <button onClick={() => handleTabChange('settings')} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-left font-medium transition ${activeTab === 'settings' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-gray-700 text-gray-300'}`}><span className="text-xl">⚙️</span> Settings</button>
                </nav>
                <div className="p-6 border-t border-gray-700 space-y-4">
                    <button onClick={() => navigate('/dashboard')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition border border-gray-600 shadow-sm text-sm"><span>👁️</span> User View</button>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-900 rounded-xl transition shadow-sm text-sm">🚪 Logout</button>
                </div>
            </aside>

            <main className="flex-1 p-4 md:p-10 h-[calc(100vh-68px)] md:h-screen overflow-y-auto w-full"><div className="max-w-7xl mx-auto h-full">{renderTabContent()}</div></main>

            {/* 💡 Broadcast Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl relative">
                        <button onClick={() => setShowBroadcastModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                        <h2 className="text-xl md:text-2xl font-extrabold text-white mb-2">📢 WhatsApp Announcement</h2>
                        <p className="text-gray-400 text-sm mb-6">Send to <span className="text-blue-400 font-bold">{selectedUserIds.length}</span> selected players.</p>
                        <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} placeholder="Type your message here... (e.g. Tonight session is cancelled due to rain!)" className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 mb-6 resize-none" />
                        <div className="flex gap-4">
                            <button onClick={() => setShowBroadcastModal(false)} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold">Cancel</button>
                            <button onClick={handleSendBroadcast} disabled={isBroadcasting} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold disabled:opacity-50">
                                {isBroadcasting ? "Sending..." : "🔥 Send Now"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Roster Modal */}
            {selectedRosterEvent && (
                <div className="fixed inset-0 bg-black/80 flex justify-end z-40 animate-fade-in backdrop-blur-sm">
                    <div className="w-full sm:max-w-md md:max-w-2xl bg-gray-900 h-full shadow-2xl border-l border-gray-700 overflow-y-auto flex flex-col transform transition-transform duration-300 translate-x-0">
                        <div className="p-6 md:p-8 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900/95 z-10"><div><h2 className="text-xl md:text-2xl font-extrabold text-white">{selectedRosterEvent.title}</h2><p className="text-gray-400 text-xs md:text-sm mt-1">Available: {selectedRosterEvent.availableSlots} / {selectedRosterEvent.totalSlots}</p></div><button onClick={closeRoster} className="text-gray-400 hover:text-white text-3xl font-bold">&times;</button></div>
                        <div className="p-4 md:p-8 flex-1 space-y-8">
                            <div>
                                <h3 className="text-base md:text-lg font-bold text-green-400 border-b border-gray-800 pb-2 mb-4">✅ Active Players</h3>
                                <div className="space-y-3">
                                    {!selectedRosterEvent.reservations || selectedRosterEvent.reservations.filter(r => r.status === 'Active').length === 0 ? <p className="text-gray-600 text-sm italic">No active players yet.</p> : selectedRosterEvent.reservations.filter(r => r.status === 'Active').map(res => {
                                        const displayGuestNames = res.guestNames || res.GuestNames;
                                        return (
                                            <div key={res.reservationId} className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-800 p-4 rounded-xl border border-gray-700 gap-3">
                                                <div>
                                                    <div className="font-bold text-white">{res.user?.username || `User #${res.userId}`}</div>
                                                    <div className="text-xs text-gray-500 mt-1">Booked Slots: <span className="text-blue-400 font-bold">{res.slotsCount}</span></div>
                                                    {displayGuestNames && <div className="text-[10px] text-yellow-400 mt-1 font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-700 inline-block">👥 +{displayGuestNames}</div>}
                                                </div>
                                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => handleTogglePayment(res.reservationId, res.user?.username)} className={`px-3 py-1 rounded text-xs font-extrabold tracking-wide transition border shadow-sm ${res.isPaid ? 'bg-green-900/40 text-green-400 border-green-800' : 'bg-red-900/40 text-red-400 border-red-800'}`}>{res.isPaid ? '💰 PAID' : '❌ UNPAID'}</button>
                                                        {!res.isPaid && <button onClick={() => handleRemindPayment(res.reservationId, res.user?.username)} className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-bold shadow-sm transition flex items-center gap-1" title="Send WhatsApp Reminder"><span>📱</span> Remind</button>}
                                                    </div>
                                                    <div className="flex gap-2"><button onClick={() => openEditBooking(res)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-blue-300 rounded text-xs font-bold">Edit</button><button onClick={() => handleRemoveBooking(res.reservationId, res.user?.username)} className="px-3 py-1 bg-red-900/40 hover:bg-red-800 text-red-300 rounded text-xs font-bold">Drop</button></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-base md:text-lg font-bold text-orange-400 border-b border-gray-800 pb-2 mb-4">⏳ Waiting List</h3>
                                <div className="space-y-3">
                                    {!selectedRosterEvent.reservations || selectedRosterEvent.reservations.filter(r => r.status === 'Waiting').length === 0 ? <p className="text-gray-600 text-sm italic">Queue is empty.</p> : selectedRosterEvent.reservations.filter(r => r.status === 'Waiting').sort((a, b) => a.queuePosition - b.queuePosition).map(res => {
                                        const displayGuestNames = res.guestNames || res.GuestNames;
                                        return (
                                            <div key={res.reservationId} className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-800 p-4 rounded-xl border border-gray-700 opacity-80 gap-3">
                                                <div>
                                                    <div className="font-bold text-gray-300"><span className="bg-orange-900/50 text-orange-400 px-2 py-0.5 rounded text-xs mr-2">#{res.queuePosition}</span>{res.user?.username || `User #${res.userId}`}</div>
                                                    <div className="text-xs text-gray-500 mt-1">Requested Slots: <span className="text-orange-300 font-bold">{res.slotsCount}</span></div>
                                                    {displayGuestNames && <div className="text-[10px] text-yellow-400 mt-1 font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-700 inline-block">👥 +{displayGuestNames}</div>}
                                                </div>
                                                <div className="flex gap-2 justify-end"><button onClick={() => openEditBooking(res)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-blue-300 rounded text-xs font-bold">Edit</button><button onClick={() => handleRemoveBooking(res.reservationId, res.user?.username)} className="px-3 py-1 bg-red-900/40 hover:bg-red-800 text-red-300 rounded text-xs font-bold">Drop</button></div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEditBookingModal && (
                <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60] animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-gray-800 p-6 md:p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-700 relative">
                        <button onClick={() => setShowEditBookingModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                        <h2 className="text-xl font-extrabold text-white mb-2">Edit Booking</h2>
                        <form onSubmit={handleUpdateBooking} className="space-y-5 mt-4">
                            <div><label className="block text-gray-400 text-sm font-semibold mb-1">Number of Slots</label><input required type="number" min="1" max="20" value={bookingFormData.slotsCount} onChange={(e) => setBookingFormData({ ...bookingFormData, slotsCount: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5" /></div>
                            <div><label className="block text-gray-400 text-sm font-semibold mb-1">Status</label><select value={bookingFormData.status} onChange={(e) => setBookingFormData({ ...bookingFormData, status: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5"><option value="Active">Active</option><option value="Waiting">Waiting</option></select></div>
                            <div className="pt-4 flex gap-3"><button type="button" onClick={() => setShowEditBookingModal(false)} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold">Cancel</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Save</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showUserModal && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-gray-800 p-6 md:p-8 rounded-2xl w-full max-w-md shadow-2xl border border-gray-700 relative">
                        <button onClick={() => setShowUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                        <h2 className="text-xl md:text-2xl font-extrabold text-white mb-6">{userFormData.userId ? 'Edit Player' : 'Add Player'}</h2>
                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div><label className="block text-gray-400 text-sm font-semibold mb-1">Username</label><input required type="text" value={userFormData.username} onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5" /></div>
                            <div>
                                <label className="block text-gray-400 text-sm font-semibold mb-1">WhatsApp Number</label>
                                <div className="flex"><span className="bg-gray-700 text-gray-300 font-bold px-3 py-2.5 rounded-l-lg border border-gray-600 border-r-0">+60</span><input required type="tel" value={userFormData.phone} onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-r-lg px-4 py-2.5" /></div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 mt-2">
                                <div className="flex-1">
                                    <label className="block text-gray-400 text-sm font-semibold mb-1">Role</label>
                                    <select value={userFormData.role} onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5">
                                        <option value="Player">Player</option>
                                        {currentUser?.role === 'SuperAdmin' && <option value="Admin">Admin</option>}
                                        {currentUser?.role === 'SuperAdmin' && <option value="SuperAdmin">SuperAdmin</option>}
                                    </select>
                                </div>
                                <div className="flex-1 flex sm:flex-col justify-end items-center sm:items-start pb-2 mt-2 sm:mt-0"><label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={userFormData.isMonthlyMember} onChange={(e) => setUserFormData({ ...userFormData, isMonthlyMember: e.target.checked })} className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-900" /><span className="text-gray-300 font-semibold">🌟 Monthly VIP</span></label></div>
                            </div>
                            <div className="pt-4 flex gap-3"><button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold">Cancel</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Save</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showEventModal && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-gray-800 p-6 md:p-8 rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-700 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setShowEventModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                        <h2 className="text-xl md:text-2xl font-extrabold text-white mb-6">{eventFormData.eventId ? 'Edit Event' : 'Schedule New Event'}</h2>
                        <form onSubmit={handleSaveEvent} className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                            <div className="flex-1 space-y-4">
                                <h3 className="text-base md:text-lg font-bold text-blue-400 border-b border-gray-700 pb-2">Event Details</h3>
                                <div><label className="block text-gray-400 text-sm font-semibold mb-1">Title</label><input required type="text" value={eventFormData.title} onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5" /></div>
                                <div><label className="block text-gray-400 text-sm font-semibold mb-1">Description</label><input type="text" value={eventFormData.description} onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5" /></div>
                                <div><label className="block text-gray-400 text-sm font-semibold mb-1">Date & Time</label><input required type="datetime-local" value={eventFormData.eventDate} onChange={(e) => setEventFormData({ ...eventFormData, eventDate: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5" /></div>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1"><label className="block text-gray-400 text-sm font-semibold mb-1">Capacity</label><input required type="number" min="1" max="100" value={eventFormData.totalSlots} onChange={(e) => setEventFormData({ ...eventFormData, totalSlots: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5" /></div>
                                    <div className="flex-1"><label className="block text-gray-400 text-sm font-semibold mb-1">Status</label><select value={eventFormData.status} onChange={(e) => setEventFormData({ ...eventFormData, status: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5"><option value="Open">Open</option><option value="Full">Full</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select></div>
                                </div>
                            </div>
                            <div className="flex-1 space-y-4">
                                <h3 className="text-base md:text-lg font-bold text-yellow-500 border-b border-gray-700 pb-2 flex justify-between items-center">
                                    <span>🌟 Pre-book VIPs</span>
                                    <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded">Selected: {eventFormData.preSelectedMemberIds.length}</span>
                                </h3>
                                {!eventFormData.eventId ? (
                                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 h-[200px] lg:h-[280px] overflow-y-auto custom-scrollbar">
                                        {monthlyMembers.length === 0 ? <p className="text-gray-500 text-sm italic text-center mt-10">No VIPs found.</p> : (
                                            <div className="space-y-2">
                                                {monthlyMembers.map(member => (
                                                    <label key={member.userId} className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer transition">
                                                        <input type="checkbox" checked={eventFormData.preSelectedMemberIds.includes(member.userId)} onChange={() => handleVipToggle(member.userId)} className="w-5 h-5 rounded border-gray-600 text-yellow-500 bg-gray-800" />
                                                        <div><div className="text-white font-semibold text-sm">{member.username}</div><div className="text-xs text-gray-500">{member.phone}</div></div>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-center h-[200px] lg:h-[280px] flex items-center justify-center flex-col"><span className="text-4xl mb-3">🛡️</span><p className="text-gray-400 text-xs md:text-sm">VIP pre-booking is only available on <strong className="text-white">New Events</strong>.</p></div>
                                )}
                            </div>
                        </form>
                        <div className="pt-6 mt-4 border-t border-gray-700 flex flex-col sm:flex-row gap-3">
                            <button type="button" onClick={() => setShowEventModal(false)} className="w-full sm:flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold">Cancel</button>
                            <button onClick={handleSaveEvent} className="w-full sm:flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">{eventFormData.eventId ? 'Save Changes' : `Publish & Book VIPs`}</button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
                .animate-fade-in { animation: fadeIn 0.2s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .bg-gray-750 { background-color: #2d3543; }
                input[type="range"] { -webkit-appearance: none; background: transparent; }
                input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #3b82f6; cursor: pointer; margin-top: -8px; }
                input[type="range"]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: #374151; border-radius: 10px; }
            `}} />
        </div>
    );
};

export default AdminPanel;