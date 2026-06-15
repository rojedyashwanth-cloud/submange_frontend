const API_BASE_URL = 'https://YOUR-GATEWAY-URL.onrender.com/api/plans';

export const getPlans = async () => {
    const response = await fetch(API_BASE_URL, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch plans.');
    }
    return data;
};

export const updatePlan = async (id, planData) => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to update plan.');
    }
    return data;
};
