import React, { useState, useEffect } from 'react';
import './App.css';
import LoginModal from './LoginModal';
import { getPlans, updatePlan } from './api/plans';
import { getSubscriptions, createSubscription, updateSubscription, deleteSubscription } from './api/subscriptions';

const AVAILABLE_ACCESSORIES = [
  { name: 'Cloud Backup', price: 50 },
  { name: 'Data Extension', price: 100 },
  { name: 'Priority Support', price: 150 }
];

const FALLBACK_PLANS = [
  { id: 1, name: 'Basic', monthlyPrice: 249.0, annualPrice: 2390.0, features: "online multiplayer;two monthly games;Email Support" },
  { id: 2, name: 'Standard', monthlyPrice: 499.0, annualPrice: 4790.0, features: "Offers a large catalog of PC games;four monthly games;Priority Email Support" },
  { id: 3, name: 'Premium', monthlyPrice: 999.0, annualPrice: 9590.0, features: "Includes everything in Core and Standard/PC;eight monthly games;24/7 Support" }
];

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState('signin');
  const [activeView, setActiveView] = useState('plans');
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  
  // Dashboard & manager states
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');


  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [editingSubscriptionId, setEditingSubscriptionId] = useState(null);
  const [isAnnual, setIsAnnual] = useState(false);

  // Fetch plans from PostgreSQL DB
  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      const data = await getPlans();
      setPlans(data);
    } catch (err) {
      console.warn("Could not fetch plans from backend, using fallbacks:", err);
      setPlans(FALLBACK_PLANS);
    } finally {
      setLoadingPlans(false);
    }
  };

  // Fetch subscriptions for active user
  const fetchUserSubscriptions = async (email) => {
    try {
      const data = await getSubscriptions(email);
      setActiveSubscriptions(data.map(sub => ({
        id: sub.id,
        name: sub.planName,
        price: sub.price,
        accessories: sub.accessories ? sub.accessories.split(';').filter(Boolean).map(item => {
          const parts = item.split(':');
          return { name: parts[0], price: parseFloat(parts[1] || '0') };
        }) : [],
        date: sub.date,
        isAnnual: sub.isAnnual,
        status: sub.status
      })));
    } catch (err) {
      console.error("Failed to load user subscriptions:", err);
    }
  };

  // Fetch ALL subscriptions (for Manager & Admin)
  const fetchAllSystemSubscriptions = async () => {
    try {
      const data = await getSubscriptions();
      setAllSubscriptions(data);
    } catch (err) {
      console.error("Failed to load all subscriptions:", err);
    }
  };

  // Handle data reload on user changes
  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'ROLE_USER') {
        fetchUserSubscriptions(user.email);
      } else {
        fetchAllSystemSubscriptions();
      }
    } else {
      setActiveSubscriptions([]);
      setAllSubscriptions([]);
    }
  }, [user]);

  const openModal = (view) => {
    setModalView(view);
    setIsModalOpen(true);
  };

  const handleSubscribe = async (planName, price) => {
    if (!user) {
      alert("Please Sign In or Sign Up to subscribe to a plan!");
      openModal('signin');
      return;
    }

    const formattedDate = new Date().toLocaleDateString();
    const subscriptionPayload = {
      userEmail: user.email,
      userName: user.name,
      planName: planName,
      price: price,
      isAnnual: isAnnual,
      date: formattedDate,
      status: 'ACTIVE',
      accessories: ''
    };

    try {
      const saved = await createSubscription(subscriptionPayload);
      const newSubscription = {
        id: saved.id,
        name: saved.planName,
        price: saved.price,
        accessories: [],
        date: saved.date,
        isAnnual: saved.isAnnual,
        status: saved.status
      };
      setActiveSubscriptions([...activeSubscriptions, newSubscription]);
      alert(`Successfully subscribed to ${planName} plan (${isAnnual ? 'Annual' : 'Monthly'})!`);
      setActiveView('active-plans');
    } catch (err) {
      alert("Subscription failed: " + err.message);
    }
  };

  const handleAddAccessory = async (subId, accessory) => {
    const sub = activeSubscriptions.find(s => s.id === subId);
    if (!sub) return;

    if (sub.accessories.find(a => a.name === accessory.name)) return;

    const newAccs = [...sub.accessories, accessory];
    const accsStr = newAccs.map(a => `${a.name}:${a.price}`).join(';');

    try {
      await updateSubscription(subId, { accessories: accsStr });
      setActiveSubscriptions(activeSubscriptions.map(s => {
        if (s.id === subId) {
          return { ...s, accessories: newAccs };
        }
        return s;
      }));
    } catch (err) {
      alert("Failed to add accessory: " + err.message);
    }
  };

  const handleRemoveAccessory = async (subId, accessoryName) => {
    const sub = activeSubscriptions.find(s => s.id === subId);
    if (!sub) return;

    const newAccs = sub.accessories.filter(a => a.name !== accessoryName);
    const accsStr = newAccs.map(a => `${a.name}:${a.price}`).join(';');

    try {
      await updateSubscription(subId, { accessories: accsStr });
      setActiveSubscriptions(activeSubscriptions.map(s => {
        if (s.id === subId) {
          return { ...s, accessories: newAccs };
        }
        return s;
      }));
    } catch (err) {
      alert("Failed to remove accessory: " + err.message);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.role === 'ROLE_USER') {
      fetchUserSubscriptions(userData.email);
      setActiveView('plans');
    } else {
      fetchAllSystemSubscriptions();
      setActiveView('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setActiveView('plans');
  };

  const handleRemoveSubscription = async (id) => {
    try {
      await deleteSubscription(id);
      setActiveSubscriptions(activeSubscriptions.filter(sub => sub.id !== id));
      if (editingSubscriptionId === id) {
        setEditingSubscriptionId(null);
      }
    } catch (err) {
      alert("Failed to cancel subscription: " + err.message);
    }
  };

  // Manager actions from dashboard
  const handleUpdateStatus = async (id, status) => {
    try {
      await updateSubscription(id, { status });
      alert(`Subscription status updated to ${status}!`);
      fetchAllSystemSubscriptions();
    } catch (err) {
      alert("Status update failed: " + err.message);
    }
  };

  const handleManagerDeleteSub = async (id) => {
    if (window.confirm("Are you sure you want to permanently cancel and remove this subscription?")) {
      try {
        await deleteSubscription(id);
        alert("Subscription removed successfully.");
        fetchAllSystemSubscriptions();
      } catch (err) {
        alert("Cancel failed: " + err.message);
      }
    }
  };

  // Calculate metrics for Dashboard
  const calculateMetrics = () => {
    let totalRevenue = 0;
    let activeCount = 0;
    let basicCount = 0;
    let standardCount = 0;
    let premiumCount = 0;

    allSubscriptions.forEach(sub => {
      if (sub.status !== 'CANCELLED') {
        activeCount++;
        
        // Base plan price
        totalRevenue += sub.price;

        // Accessories sum
        if (sub.accessories) {
          const accs = sub.accessories.split(';').filter(Boolean);
          accs.forEach(acc => {
            const parts = acc.split(':');
            const price = parseFloat(parts[1] || '0');
            // If it's an annual subscription, the accessory monthly price is accumulated based on period context (we add monthly acc * 12 if annual)
            totalRevenue += sub.isAnnual ? price * 12 : price;
          });
        }

        // Count tier
        const nameLower = sub.planName.toLowerCase();
        if (nameLower.includes('basic')) basicCount++;
        else if (nameLower.includes('premium')) premiumCount++;
        else standardCount++;
      }
    });

    const averageValue = activeCount > 0 ? (totalRevenue / activeCount) : 0;

    return {
      totalRevenue,
      activeCount,
      averageValue,
      basicCount,
      standardCount,
      premiumCount
    };
  };

  const metrics = calculateMetrics();

  // Filter subscriptions in Dashboard
  const filteredSubscriptions = allSubscriptions.filter(sub => {
    const matchesSearch = 
      sub.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) || 
      sub.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.planName.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = 
      statusFilter === 'ALL' ? true : sub.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="web">
      {/* Injected Premium CSS Styles for dashboard & modals */}
      <style>{`
        /* Premium Dashboard layout */
        .manager-dashboard {
          background: rgba(30, 41, 59, 0.4);
          border-radius: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 2.5rem;
          margin-top: 1rem;
          backdrop-filter: blur(20px);
        }
        .dashboard-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }
        .metric-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.25rem;
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .metric-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 60%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .metric-card:hover {
          transform: translateY(-5px);
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 12px 40px rgba(99, 102, 241, 0.15);
        }
        .metric-card:hover::before {
          opacity: 1;
        }
        .metric-title {
          font-size: 0.8rem;
          text-transform: uppercase;
          color: #94a3b8;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 0.5rem;
        }
        .metric-value {
          font-size: 2.25rem;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1.2;
        }
        .metric-desc {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 0.5rem;
        }
        .plans-breakdown {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.25rem;
          padding: 2rem;
          margin-bottom: 2.5rem;
        }
        .breakdown-title {
          font-size: 1.15rem;
          font-weight: 800;
          margin-bottom: 1.5rem;
          color: #f8fafc;
          letter-spacing: -0.01em;
        }
        .breakdown-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }
        .breakdown-item {
          background: rgba(30, 41, 59, 0.3);
          padding: 1.25rem;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .breakdown-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #cbd5e1;
        }
        .breakdown-bar-bg {
          background: rgba(15, 23, 42, 0.6);
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
        }
        .breakdown-bar-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, #6366f1, #a855f7);
        }
        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        .search-input {
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #f8fafc !important;
          padding: 0.75rem 1.25rem !important;
          border-radius: 0.75rem !important;
          font-size: 0.9rem !important;
          outline: none !important;
          width: 100% !important;
          max-width: 320px !important;
          transition: all 0.3s ease;
        }
        .search-input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.2) !important;
        }
        .filter-select {
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #f8fafc !important;
          padding: 0.75rem 1.25rem !important;
          border-radius: 0.75rem !important;
          font-size: 0.9rem !important;
          outline: none !important;
          cursor: pointer !important;
        }
        .dashboard-table-container {
          overflow-x: auto;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          background: rgba(30, 41, 59, 0.2);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }
        .dashboard-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }
        .dashboard-table th {
          background: rgba(15, 23, 42, 0.9);
          color: #94a3b8;
          padding: 1.1rem 1.5rem;
          font-weight: 700;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .dashboard-table td {
          padding: 1.1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
          vertical-align: middle;
        }
        .dashboard-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
        }
        .status-active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }
        .status-paid {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }
        .status-cancelled {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
        .action-btn {
          background: transparent;
          border: 1px solid;
          padding: 0.45rem 0.9rem;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;
        }
        .action-cancel {
          border-color: rgba(239, 68, 68, 0.4);
          color: #ef4444;
        }
        .action-cancel:hover {
          background: #ef4444;
          color: white;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        .action-approve {
          border-color: rgba(16, 185, 129, 0.4);
          color: #10b981;
          margin-right: 0.5rem;
        }
        .action-approve:hover {
          background: #10b981;
          color: white;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .refresh-btn {
          background: rgba(99, 102, 241, 0.1);
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 0.6rem 1.25rem;
          border-radius: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .refresh-btn:hover {
          background: #6366f1;
          color: white;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        }
        .role-badge {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 0.5rem;
          font-weight: bold;
          text-transform: uppercase;
          margin-left: 0.5rem;
          vertical-align: middle;
        }
      `}</style>

      <header>
        <div className="title">
          <h1>
            SUBSCRIPTION MANAGEMENT
            {user && (
              <span className="role-badge">
                {user.role === 'ROLE_ADMIN' ? 'Admin' : user.role === 'ROLE_MANAGER' ? 'Manager' : 'User'}
              </span>
            )}
          </h1>
        </div>
        <nav>
          <ul>
            {user ? (
              <>
                <li className="user-info">Hi, {user.name}</li>
                
                {/* User Role navigation links */}
                {user.role === 'ROLE_USER' && (
                  <>
                    <li onClick={() => setActiveView('plans')} className={activeView === 'plans' ? 'active' : ''}>Plans</li>
                    <li onClick={() => setActiveView('active-plans')} className={activeView === 'active-plans' ? 'active' : ''}>Active Plans</li>
                  </>
                )}

                {/* Manager / Admin Navigation links */}
                {(user.role === 'ROLE_MANAGER' || user.role === 'ROLE_ADMIN') && (
                  <>
                    <li onClick={() => setActiveView('plans')} className={activeView === 'plans' ? 'active' : ''}>View Plans</li>
                    <li onClick={() => setActiveView('dashboard')} className={activeView === 'dashboard' ? 'active' : ''}>Manager Dashboard</li>
                  </>
                )}

                <li onClick={handleLogout}>Logout</li>
              </>
            ) : (
              <>
                <li onClick={() => openModal('signin')}>Sign In</li>
                <li onClick={() => openModal('signup')}>Sign Up</li>
                <li onClick={() => setActiveView('plans')} className={activeView === 'plans' ? 'active' : ''}>Plans</li>
              </>
            )}
          </ul>
        </nav>
      </header>

      <div className="container">
        {activeView === 'plans' ? (
          <section id="plans">
            <div className="heading">
              <h2>Choose Your Plan</h2>
              <p>Simple and transparent pricing.</p>
              {user && user.role === 'ROLE_ADMIN' && (
                <div style={{ marginTop: '15px', color: '#10b981', fontWeight: 600, fontSize: '0.95rem' }}>
                  ⚡ Admin Mode: Click "Edit Plan" on cards to modify details.
                </div>
              )}
            </div>
            
            <div className="pricing-toggle-container">
              <div className="pricing-toggle">
                <button 
                  className={`toggle-btn ${!isAnnual ? 'active' : ''}`} 
                  onClick={() => setIsAnnual(false)}
                >
                  Monthly
                </button>
                <button 
                  className={`toggle-btn ${isAnnual ? 'active' : ''}`} 
                  onClick={() => setIsAnnual(true)}
                >
                  Annual <span className="save-badge">Save 20%</span>
                </button>
              </div>
            </div>

            {loadingPlans ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                Loading subscription plans...
              </div>
            ) : (
              <div className="plansName" style={{ justifyContent: 'center' }}>
                {plans.map(p => {
                  const monthly = p.monthlyPrice;
                  // If database doesn't calculate discounts, apply 20% discount on Annual plans dynamically
                  const annual = p.annualPrice || Math.round(monthly * 12 * 0.8);
                  const price = isAnnual ? annual : monthly;
                  const featuresList = p.features ? p.features.split(';').filter(Boolean) : [];

                  return (
                    <div className="plan" key={p.id}>
                      {/* Admin edit plan controls */}
                      {user && user.role === 'ROLE_ADMIN' && (
                        <button 
                          className="action-btn"
                          style={{
                            position: 'absolute',
                            top: '15px',
                            right: '15px',
                            borderColor: 'rgba(99, 102, 241, 0.6)',
                            color: '#818cf8',
                            padding: '0.35rem 0.7rem',
                            fontSize: '0.75rem',
                            borderRadius: '0.375rem',
                            backgroundColor: 'rgba(30, 41, 59, 0.9)'
                          }}
                          onClick={() => setEditingPlan({
                            id: p.id,
                            name: p.name,
                            monthlyPrice: p.monthlyPrice,
                            annualPrice: p.annualPrice || Math.round(p.monthlyPrice * 12 * 0.8),
                            features: p.features || ""
                          })}
                        >
                          Edit Plan
                        </button>
                      )}

                      <h3>{p.name}</h3>
                      <ul>
                        {featuresList.map((f, index) => (
                          <li key={index}>{f}</li>
                        ))}
                        <li>Price: ₹{price}{isAnnual ? ' /year' : ' /month'}</li>
                      </ul>
                      
                      {/* Show subscribe options for USER, hide for Managers */}
                      {(!user || user.role === 'ROLE_USER') && (
                        <button 
                          className="cart" 
                          onClick={() => handleSubscribe(p.name, price)}
                        >
                          Subscribe
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : activeView === 'active-plans' ? (
          <section id="active-subscriptions">
            <div className="heading">
              <h2>Your Active Plans</h2>
              <p>Manage your current subscriptions here.</p>
            </div>
            
            <div className="active-plans-container">
              {activeSubscriptions.length > 0 ? (
                <div className="checkout-dashboard">
                  {/* Left Side: Plan & Add-ons */}
                  <div className="customization-area">
                    <div className="view-header">
                      <h2>Customize Your Plan</h2>
                      <p>Add features and customize your subscription to match your exact requirements.</p>
                    </div>

                    {(() => {
                      const currentId = editingSubscriptionId || activeSubscriptions[0]?.id;
                      const sub = activeSubscriptions.find(s => s.id === currentId);
                      if (!sub) return null;

                      return (
                        <>
                          <div className="selected-plan-banner">
                            <div className="banner-info">
                              <h3>{sub.name} Plan</h3>
                              <p>Configured as {sub.isAnnual ? 'Annual' : 'Monthly'} Subscription</p>
                              <p style={{ marginTop: '5px', fontSize: '0.85rem', color: '#10b981' }}>
                                Status: {sub.status}
                              </p>
                            </div>
                            <div className="banner-price">
                              <span className="currency">₹</span>
                              <span className="amount">{sub.price}</span>
                              <span className="period">{sub.isAnnual ? '/year' : '/month'}</span>
                            </div>
                          </div>

                          <div className="addons-section">
                            <div className="section-head">
                              <h3>Add-ons & Extras</h3>
                            </div>
                            <div className="addons-list">
                              {AVAILABLE_ACCESSORIES.map(acc => {
                                const isAdded = sub.accessories.some(a => a.name === acc.name);
                                return (
                                  <div className={`addon-row ${isAdded ? 'active' : ''}`} key={acc.name}>
                                    <div className="addon-meta">
                                      <div className="checkbox-wrap">
                                        <input 
                                          type="checkbox" 
                                          checked={isAdded} 
                                          onChange={() => isAdded ? handleRemoveAccessory(sub.id, acc.name) : handleAddAccessory(sub.id, acc)}
                                        />
                                      </div>
                                      <div className="addon-text">
                                        <p className="name">{acc.name}</p>
                                        <p className="desc">Enhanced capacity and features</p>
                                      </div>
                                    </div>
                                    <div className="addon-price">
                                      ₹{acc.price}/mo
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Right Side: Order Summary */}
                  <div className="summary-side">
                    {(() => {
                      const currentId = editingSubscriptionId || activeSubscriptions[0]?.id;
                      const sub = activeSubscriptions.find(s => s.id === currentId);
                      if (!sub) return null;
                      
                      const totalAddons = sub.accessories.reduce((sum, acc) => sum + acc.price, 0);
                      const grandTotal = sub.price + (sub.isAnnual ? totalAddons * 12 : totalAddons);

                      return (
                        <div className="order-summary-card">
                          <h3>Order Summary</h3>
                          <div className="summary-lines">
                            <div className="line">
                              <span>{sub.name} Plan</span>
                              <span>₹{sub.price.toFixed(2)}</span>
                            </div>
                            {sub.accessories.map(acc => (
                              <div className="line addon-line" key={acc.name}>
                                <span>{acc.name}</span>
                                <span>+{sub.isAnnual ? `₹${(acc.price * 12).toFixed(2)}/yr` : `₹${acc.price.toFixed(2)}/mo`}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="summary-total">
                            <span className="total-label">Total</span>
                            <div className="total-amount">
                              <span className="amount">₹{grandTotal.toFixed(2)}</span>
                              <span className="period">{sub.isAnnual ? '/year' : '/month'}</span>
                            </div>
                          </div>

                          <button className="activate-btn" onClick={async () => {
                            try {
                              await updateSubscription(sub.id, { status: "PAID" });
                              alert('Payment Successful! Status updated to PAID.');
                              fetchUserSubscriptions(user.email);
                            } catch (err) {
                              alert("Payment failed: " + err.message);
                            }
                          }}>
                            Make Payment
                          </button>
                          
                          <button className="cancel-btn" onClick={() => {
                            if (window.confirm("Are you sure you want to cancel this subscription?")) {
                              handleRemoveSubscription(sub.id);
                              alert("Subscription cancelled successfully.");
                            }
                          }}>
                            Cancel Subscription
                          </button>

                          {activeSubscriptions.length > 1 && (
                            <div className="plan-switcher">
                              <p>Managing {activeSubscriptions.length} Plans</p>
                              <select 
                                value={currentId} 
                                onChange={(e) => setEditingSubscriptionId(parseInt(e.target.value))}
                              >
                                {activeSubscriptions.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} Plan ({s.date})</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="no-subscriptions">
                  <p>You don't have any active subscriptions yet.</p>
                  <button className="browse-btn" onClick={() => setActiveView('plans')}>Browse Plans</button>
                </div>
              )}
            </div>
          </section>
        ) : (
          /* Premium Analytical Manager Dashboard view */
          <section id="manager-dashboard">
            <div className="heading">
              <h2>Analytics & Subscription Control</h2>
              <p>System metrics, tracking, and customer administration.</p>
            </div>

            <div className="manager-dashboard">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Global Overview</h3>
                <button className="refresh-btn" onClick={fetchAllSystemSubscriptions}>
                  🔄 Refresh Data
                </button>
              </div>

              {/* Stat Cards */}
              <div className="dashboard-metrics">
                <div className="metric-card">
                  <span className="metric-title">System Run Rate</span>
                  <span className="metric-value">₹{metrics.totalRevenue.toLocaleString()}</span>
                  <span className="metric-desc">Total accumulated revenue across subscriptions</span>
                </div>
                <div className="metric-card">
                  <span className="metric-title">Active Customers</span>
                  <span className="metric-value">{metrics.activeCount}</span>
                  <span className="metric-desc">Non-cancelled registered subscriptions</span>
                </div>
                <div className="metric-card">
                  <span className="metric-title">Average Account Value</span>
                  <span className="metric-value">₹{Math.round(metrics.averageValue).toLocaleString()}</span>
                  <span className="metric-desc">Average billing value per active account</span>
                </div>
              </div>

              {/* Progress Bar Tier Breakdown */}
              <div className="plans-breakdown">
                <h4 className="breakdown-title">Subscribed Tiers Distribution</h4>
                <div className="breakdown-grid">
                  <div className="breakdown-item">
                    <div className="breakdown-info">
                      <span>Basic Plan</span>
                      <span>{metrics.basicCount} Active</span>
                    </div>
                    <div className="breakdown-bar-bg">
                      <div 
                        className="breakdown-bar-fill" 
                        style={{ width: metrics.activeCount > 0 ? `${(metrics.basicCount / metrics.activeCount) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  
                  <div className="breakdown-item">
                    <div className="breakdown-info">
                      <span>Standard Plan</span>
                      <span>{metrics.standardCount} Active</span>
                    </div>
                    <div className="breakdown-bar-bg">
                      <div 
                        className="breakdown-bar-fill" 
                        style={{ width: metrics.activeCount > 0 ? `${(metrics.standardCount / metrics.activeCount) * 100}%` : '0%', background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }}
                      />
                    </div>
                  </div>

                  <div className="breakdown-item">
                    <div className="breakdown-info">
                      <span>Premium Plan</span>
                      <span>{metrics.premiumCount} Active</span>
                    </div>
                    <div className="breakdown-bar-bg">
                      <div 
                        className="breakdown-bar-fill" 
                        style={{ width: metrics.activeCount > 0 ? `${(metrics.premiumCount / metrics.activeCount) * 100}%` : '0%', background: 'linear-gradient(90deg, #ec4899, #8b5cf6)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Grid Section */}
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>Detailed Subscription Registry</h3>
              
              <div className="controls-row">
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search by customer, email, plan..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                <select 
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAID">PAID</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="dashboard-table-container">
                {filteredSubscriptions.length > 0 ? (
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Plan Info</th>
                        <th>Period</th>
                        <th>Accessories Addons</th>
                        <th>Price</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubscriptions.map(sub => {
                        const hasAccs = sub.accessories && sub.accessories.trim().length > 0;
                        const accsList = hasAccs 
                          ? sub.accessories.split(';').filter(Boolean).map(a => a.split(':')[0]).join(', ')
                          : "None";

                        return (
                          <tr key={sub.id}>
                            <td>
                              <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>{sub.userName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{sub.userEmail}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 'bold' }}>{sub.planName}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem' }}>{sub.isAnnual ? 'Annual' : 'Monthly'}</span>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={accsList}>
                              {accsList}
                            </td>
                            <td style={{ fontWeight: 'bold', color: '#6366f1' }}>
                              ₹{sub.price}
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>{sub.date}</td>
                            <td>
                              <span className={`status-badge ${
                                sub.status === 'ACTIVE' ? 'status-active' : sub.status === 'PAID' ? 'status-paid' : 'status-cancelled'
                              }`}>
                                {sub.status}
                              </span>
                            </td>
                            <td>
                              {sub.status !== 'CANCELLED' ? (
                                <div style={{ display: 'flex' }}>
                                  {sub.status === 'ACTIVE' && (
                                    <button 
                                      className="action-btn action-approve"
                                      onClick={() => handleUpdateStatus(sub.id, 'PAID')}
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                  <button 
                                    className="action-btn action-cancel"
                                    onClick={() => handleManagerDeleteSub(sub.id)}
                                  >
                                    Suspend
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>Inactive</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No matching subscriptions found in the registry.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Floating Plan Editor Modal for ADMIN role */}
      {editingPlan && (
        <div className="overlay" onClick={() => setEditingPlan(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button className="close" onClick={() => setEditingPlan(null)}>&times;</button>
            <div className="head">
              <h2>Edit {editingPlan.name} Plan</h2>
              <p>Configure base prices and system characteristics in real time.</p>
            </div>
            
            <form 
              className="form" 
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await updatePlan(editingPlan.id, {
                    name: editingPlan.name,
                    monthlyPrice: parseFloat(editingPlan.monthlyPrice),
                    annualPrice: parseFloat(editingPlan.annualPrice),
                    features: editingPlan.features
                  });
                  alert("Plan details saved successfully!");
                  setEditingPlan(null);
                  fetchPlans();
                } catch (err) {
                  alert("Failed to update plan: " + err.message);
                }
              }}
            >
              <div className="box">
                <label>Plan Name</label>
                <input 
                  type="text" 
                  value={editingPlan.name} 
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} 
                  required
                />
              </div>

              <div className="box">
                <label>Monthly Price (₹)</label>
                <input 
                  type="number" 
                  value={editingPlan.monthlyPrice} 
                  onChange={e => setEditingPlan({ ...editingPlan, monthlyPrice: e.target.value })} 
                  required
                />
              </div>

              <div className="box">
                <label>Annual Price (₹)</label>
                <input 
                  type="number" 
                  value={editingPlan.annualPrice} 
                  onChange={e => setEditingPlan({ ...editingPlan, annualPrice: e.target.value })} 
                  required
                />
              </div>

              <div className="box">
                <label>Plan Features (Semicolon separated)</label>
                <textarea 
                  value={editingPlan.features} 
                  onChange={e => setEditingPlan({ ...editingPlan, features: e.target.value })} 
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    backgroundColor: '#fff',
                    color: '#333',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  placeholder="e.g. online multiplayer;two monthly games;Email Support"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Use semicolons (;) to separate features shown as bullet points on cards.
                </span>
              </div>

              <button type="submit" className="btn">Save Plan Details</button>
            </form>
          </div>
        </div>
      )}

      <footer>
        <div>
          <h3>Team Arkadas</h3>
          <p>© 2026 Arkadas. All rights reserved.</p>
        </div>
      </footer>

      <LoginModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLoginSuccess={handleLogin}
        initialView={modalView}
      />
    </div>
  );
}

export default App;
