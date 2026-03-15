import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api/apiConfig';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [showContactModal, setShowContactModal] = useState(false);

  const navigate = useNavigate();

  const adminContact = {
    name: "Bryan (Head Admin)",
    phone: "+601133043517",
    whatsappLink: "https://wa.me/601133043517"
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const cleanPhone = phone.replace(/^60/, '').replace(/^0/, '');
      const finalPhone = '60' + cleanPhone;

      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        phone: finalPhone,
        password
      });

      if (response.status === 200) {
        localStorage.setItem('user', JSON.stringify(response.data));

        if (response.data.role === 'Admin' || response.data.role === 'SuperAdmin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response) {
        if (error.response.status === 403) {
          setErrorMsg(error.response.data.message || 'Your account is blacklisted.');
        } else if (error.response.status === 401 || error.response.status === 404) {
          setErrorMsg(error.response.data.message || 'Invalid phone number or password.');
        } else {
          setErrorMsg('An unexpected error occurred. Please try again.');
        }
      } else {
        setErrorMsg('Network error. Unable to reach the server.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans relative overflow-hidden">

      {/* ✨ 背景光晕装饰 (Ambient Background Glows) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl p-8 sm:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 relative z-10 animate-fade-in-up">

        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner border border-blue-100/50 mx-auto">
            🏸
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Sign in to Badminton Hub</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">WhatsApp Number</label>
            <div className="flex shadow-sm rounded-2xl overflow-hidden border border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300 bg-white">
              <span className="bg-slate-50 text-slate-500 font-bold px-4 sm:px-5 py-3 sm:py-4 border-r border-slate-200 flex items-center justify-center select-none">
                +60
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="123456789"
                className="w-full px-4 sm:px-5 py-3 sm:py-4 outline-none text-slate-800 text-base sm:text-lg font-semibold bg-transparent"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2 px-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <button type="button" onClick={() => setShowContactModal(true)} className="text-xs font-bold text-blue-600 hover:text-blue-500 transition focus:outline-none">
                Forgot?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-5 py-3 sm:py-4 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 outline-none text-slate-800 text-base sm:text-lg font-semibold shadow-sm bg-white"
              required
            />

            {/* Error Message */}
            {errorMsg && (
              <div className="mt-4 p-4 bg-red-50/80 border border-red-100 rounded-2xl flex items-start gap-3 animate-fade-in">
                <span className="text-red-500 text-lg leading-none mt-0.5">⚠️</span>
                <p className="text-sm text-red-600 font-bold leading-tight">{errorMsg}</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex justify-center items-center py-4 px-5 mt-4 rounded-2xl shadow-lg shadow-blue-500/30 text-base font-black text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all duration-200 tracking-wide"
          >
            SIGN IN
          </button>
        </form>

        <div className="mt-10 text-center text-sm text-slate-500 font-medium">
          New to the court? {' '}
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="font-black text-slate-900 hover:text-blue-600 underline decoration-2 underline-offset-4 transition focus:outline-none"
          >
            Contact Admin
          </button>
        </div>
      </div>

      {/* ✨ Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex justify-center items-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 animate-slide-up">
            <div className="p-8 text-center relative">
              <button
                onClick={() => setShowContactModal(false)}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition font-bold focus:outline-none"
              >
                &times;
              </button>
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner border border-blue-100/50">
                🛡️
              </div>
              <h3 className="text-xl font-black text-slate-900">Need Help?</h3>
              <p className="text-slate-500 text-sm font-medium mt-2 leading-relaxed">
                To register a new account or reset your password, please message our admin.
              </p>

              <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl mt-6">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Admin In-Charge</p>
                <p className="text-lg font-black text-slate-800">{adminContact.name}</p>
                <a
                  href={adminContact.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-white bg-[#25D366] hover:bg-[#20bd5a] px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-[#25D366]/30 active:scale-95 transition-all w-full justify-center"
                >
                  <span className="text-lg">💬</span> WhatsApp Now
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline styles for custom subtle animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        @keyframes blob { 
          0% { transform: translate(0px, 0px) scale(1); } 
          33% { transform: translate(30px, -50px) scale(1.1); } 
          66% { transform: translate(-20px, 20px) scale(0.9); } 
          100% { transform: translate(0px, 0px) scale(1); } 
        }
      `}} />
    </div>
  );
};

export default Login;