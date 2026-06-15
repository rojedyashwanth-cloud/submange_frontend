const API_BASE_URL = 'https://submange-bankend-2.onrender.com/api/users';

export const login = async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Incorrect email or password. Please try again.');
    }

    return data;
};

export const signup = async (name, email, password, role) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password, role })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'An account with this email already exists.');
    }

    return data;
};
