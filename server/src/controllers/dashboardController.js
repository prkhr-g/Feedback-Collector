import { getDashboardCharts, getDashboardStats } from '../services/dashboardService.js';

export async function dashboardStats(_request, response, next) {
  try {
    const data = await getDashboardStats();
    return response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function dashboardCharts(_request, response, next) {
  try {
    const data = await getDashboardCharts();
    return response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
