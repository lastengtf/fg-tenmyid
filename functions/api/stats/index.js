// GET /api/stats - Dashboard summary metrics
import { jsonResponse, getAllProjects, getAllClients } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  const projects = await getAllProjects(env);
  const clients = await getAllClients(env);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let activeProjectsCount = 0;
  let upcomingShootsCount = 0;
  let inEditingCount = 0;
  let galleryReadyCount = 0;
  let totalRevenue = 0;
  let totalUnpaidAmount = 0;
  let unpaidProjectsCount = 0;

  const upcomingList = [];

  for (const p of projects) {
    if (p.workflowStatus !== 'completed') {
      activeProjectsCount++;
    }

    if (p.workflowStatus === 'editing') {
      inEditingCount++;
    }

    if (p.workflowStatus === 'gallery_ready') {
      galleryReadyCount++;
    }

    // Check shoot date
    if (p.date && p.date >= todayStr && p.date <= next7Days && p.workflowStatus !== 'completed') {
      upcomingShootsCount++;
      upcomingList.push(p);
    }

    const total = Number(p.totalPrice) || 0;
    const dp = Number(p.dpAmount) || 0;
    totalRevenue += dp; // money already in

    if (p.paymentStatus !== 'paid' && total > dp) {
      totalUnpaidAmount += (total - dp);
      unpaidProjectsCount++;
    } else if (p.paymentStatus === 'paid') {
      totalRevenue += (total - dp);
    }
  }

  // Sort upcoming shoots ascending
  upcomingList.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return jsonResponse({
    stats: {
      totalClients: clients.length,
      totalProjects: projects.length,
      activeProjects: activeProjectsCount,
      upcomingShoots: upcomingShootsCount,
      inEditing: inEditingCount,
      galleryReady: galleryReadyCount,
      totalUnpaidAmount,
      unpaidProjectsCount,
      totalRevenue
    },
    upcomingList: upcomingList.slice(0, 5),
    recentProjects: projects.slice(0, 5)
  });
}
