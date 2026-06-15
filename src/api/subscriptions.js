const API_BASE_URL = 'https://YOUR-GATEWAY-URL.onrender.com/api/subscriptions';

export const getSubscriptions = async (email = '') => {
    let url = API_BASE_URL;
    if (email) {
        url += `?email=${encodeURIComponent(email)}`;
    }
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch subscriptions.');
    }
    return data;
};

export const createSubscription = async (subscriptionData) => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to create subscription.');
    }
    return data;
};

export const updateSubscription = async (id, subscriptionData) => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to update subscription.');
    }
    return data;
};

export const deleteSubscription = async (id) => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete subscription.');
    }
    return true;
};
