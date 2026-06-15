import React, { useState } from 'react';
import './LoginModal.css';
import { login, signup } from './api/auth';

const LoginModal = ({
    isOpen,
    onClose,
    onLoginSuccess,
    initialView = 'signin'
}) => {
    const [view, setView] = useState(initialView);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('ROLE_USER');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            setView(initialView);
            setEmail('');
            setPassword('');
            setName('');
            setRole('ROLE_USER');
            setErrorMsg('');
            setIsLoading(false);
        }
    }, [initialView, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        
        if (!email || !password || (view === 'signup' && !name)) {
            setErrorMsg('Please fill in all required fields.');
            return;
        }

        setIsLoading(true);

        try {
            let authResponse;
            if (view === 'signup') {
                authResponse = await signup(name, email, password, role);
            } else {
                authResponse = await login(email, password);
            }

            // Store the session data in localStorage
            localStorage.setItem('auth_token', authResponse.token);
            localStorage.setItem('auth_user', JSON.stringify(authResponse.user));
            
            onLoginSuccess(authResponse.user);
            alert(view === 'signup' ? 'Account created and logged in successfully!' : 'Logged in successfully!');
            onClose();
        } catch (error) {
            setErrorMsg(error.message || 'Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="overlay"
            onClick={onClose}
        >
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="close"
                    onClick={onClose}
                >
                    &times;
                </button>
                <div className="head">
                    <h2>
                        {view === 'signin' ? 'Sign In' : 'Sign Up'}
                    </h2>
                    <p>
                        {view === 'signin'
                            ? 'Welcome back! Please enter your details.'
                            : 'Create an account to get started.'}
                    </p>
                </div>
                <form
                    className="form"
                    onSubmit={handleSubmit}
                >
                    {view === 'signup' && (
                        <div className="box">
                            <label>Full Name</label>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div className="box">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="box">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {errorMsg && <div className="error-message" style={{ color: '#e74c3c', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>{errorMsg}</div>}
                    <button
                        type="submit"
                        className="btn"
                        disabled={isLoading}
                        style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                    >
                        {isLoading ? 'Please wait...' : (view === 'signin' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>
                <div className="foot">
                    <p>
                        {view === 'signin'
                            ? "Don't have an account?"
                            : "Already have an account?"}{' '}
                        <span
                            onClick={() => setView(view === 'signin' ? 'signup' : 'signin')}
                        >
                            {view === 'signin' ? 'Sign Up' : 'Sign In'}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
