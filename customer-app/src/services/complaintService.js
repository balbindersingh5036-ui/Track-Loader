import api from './api';

const complaintService = {
  async createComplaint(payload) {
    const { data } = await api.post('/complaints', payload);
    return data.data.complaint;
  },
  async getMyComplaints(params = {}) {
    const { data } = await api.get('/complaints/my', { params });
    return data.data;
  },
  async getComplaint(id) {
    const { data } = await api.get(`/complaints/${encodeURIComponent(id)}`);
    return data.data.complaint;
  }
};

export default complaintService;
