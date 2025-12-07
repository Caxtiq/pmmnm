/*
 * Copyright 2025 PKA-OpenLD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faMap, 
  faExclamationTriangle, 
  faBolt,
  faUsers,
  faNewspaper,
  faTrash,
  faCheck,
  faEye,
  faTimes,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import Maps from "@/components/Maps/Maps";
import { useToast } from "@/components/ToastProvider";

interface Stats {
  totalZones: number;
  totalReports: number;
  totalSensors: number;
  activeAlerts: number;
  pendingReports: number;
}

interface Zone {
  id: string;
  type: 'flood' | 'outage';
  title?: string;
  description?: string;
  riskLevel?: number;
}

interface Report {
  id: string;
  type: 'flood' | 'outage' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'new' | 'investigating' | 'resolved';
  reporterName?: string;
  createdAt: number;
  voteScore?: number;
  zoneCreated?: boolean;
  adminApproved?: boolean;
}

export default function AdminPage() {
  const { showToast } = useToast();
  const [view, setView] = useState<'dashboard' | 'map'>('dashboard');
  const [stats, setStats] = useState<Stats>({
    totalZones: 0,
    totalReports: 0,
    totalSensors: 0,
    activeAlerts: 0,
    pendingReports: 0
  });
  const [zones, setZones] = useState<Zone[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<'all' | 'new' | 'investigating' | 'resolved'>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [users, setUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, reportsRes, usersRes] = await Promise.all([
        fetch('/api/zones'),
        fetch('/api/user-reports'),
        fetch('/api/users')
      ]);
      
      const zonesData = await zonesRes.json();
      const reportsData = await reportsRes.json();
      const usersData = await usersRes.json();
      
      setZones(zonesData.zones || []);
      setReports(reportsData.reports || []);
      setUsers(usersData.users || []);
      
      const pendingReports = reportsData.reports?.filter((r: Report) => r.status === 'new').length || 0;
      
      setStats({
        totalZones: zonesData.zones?.length || 0,
        totalReports: reportsData.reports?.length || 0,
        totalSensors: 0,
        activeAlerts: zonesData.zones?.filter((z: Zone) => (z.riskLevel || 0) > 7).length || 0,
        pendingReports
      });
      
      setLoading(false);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Bạn có chắc muốn xóa khu vực này?')) return;
    
    try {
      await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete zone:', error);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'investigating' | 'resolved') => {
    try {
      await fetch(`/api/user-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (error) {
      console.error('Failed to update report:', error);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Bạn có chắc muốn xóa báo cáo này?')) return;
    
    try {
      await fetch(`/api/user-reports/${reportId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  const handleApproveReport = async (reportId: string) => {
    if (!confirm('Phê duyệt báo cáo này và tạo khu vực ngay lập tức?')) return;
    
    try {
      const response = await fetch('/api/user-reports/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Đã phê duyệt và tạo khu vực thành công!', 'success');
        fetchData();
      } else {
        showToast(data.message || 'Không thể tạo khu vực', 'error');
      }
    } catch (error) {
      console.error('Failed to approve report:', error);
      showToast('Lỗi khi phê duyệt báo cáo', 'error');
    }
  };

  const filteredReports = reports
    .filter(r => reportFilter === 'all' || r.status === reportFilter)
    .filter(r => selectedUser === 'all' || r.reporterName === selectedUser)
    .filter(r => reportSearch === '' || 
      r.description.toLowerCase().includes(reportSearch.toLowerCase()) ||
      r.reporterName?.toLowerCase().includes(reportSearch.toLowerCase())
    );

  if (view === 'map') {
    return (
      <div className="relative">
        <Maps isAdmin={true} />
        <button
          onClick={() => setView('dashboard')}
          className="fixed top-4 left-4 z-50 bg-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span className="font-semibold">Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-4xl">🛡️</span>
                Admin Dashboard
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-gray-400">Quản lý hệ thống giám sát thời gian thực</p>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Cập nhật {lastUpdate.toLocaleTimeString('vi-VN')}
                </span>
              </div>
            </div>
            <button
              onClick={() => setView('map')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg"
            >
              <FontAwesomeIcon icon={faMap} />
              Xem Bản Đồ
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Khu Vực</p>
                <p className="text-4xl font-bold text-white mt-2">{stats.totalZones}</p>
              </div>
              <FontAwesomeIcon icon={faMap} className="text-5xl text-blue-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Báo Cáo</p>
                <p className="text-4xl font-bold text-white mt-2">{stats.totalReports}</p>
              </div>
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-5xl text-red-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Cảnh Báo</p>
                <p className="text-4xl font-bold text-white mt-2">{stats.activeAlerts}</p>
              </div>
              <FontAwesomeIcon icon={faBolt} className="text-5xl text-yellow-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Chờ Xử Lý</p>
                <p className="text-4xl font-bold text-white mt-2">{stats.pendingReports}</p>
              </div>
              <FontAwesomeIcon icon={faNewspaper} className="text-5xl text-purple-200 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Sensors</p>
                <p className="text-4xl font-bold text-white mt-2">{stats.totalSensors}</p>
              </div>
              <FontAwesomeIcon icon={faChartLine} className="text-5xl text-green-200 opacity-50" />
            </div>
          </div>
        </div>

        {/* Reports Management */}
        <div className="bg-gray-800 rounded-2xl shadow-xl mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                Quản Lý Báo Cáo ({filteredReports.length})
              </h2>
              <button
                onClick={fetchData}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
              >
                🔄 Làm mới
              </button>
            </div>
            <div className="flex gap-3 mt-4">
              <input
                type="text"
                placeholder="🔍 Tìm kiếm báo cáo..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
              />
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40"
              >
                <option value="all">👤 Tất cả người dùng</option>
                {users.filter(u => u.role !== 'admin').map(user => (
                  <option key={user.id} value={user.username}>
                    {user.username}
                  </option>
                ))}
              </select>
              <select
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value as any)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40"
              >
                <option value="all">📋 Tất cả trạng thái</option>
                <option value="new">🆕 Mới</option>
                <option value="investigating">🔍 Đang xử lý</option>
                <option value="resolved">✅ Đã xử lý</option>
              </select>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Đang tải...</div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {reportSearch || reportFilter !== 'all' ? 'Không tìm thấy báo cáo phù hợp' : 'Chưa có báo cáo nào'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.slice(0, 20).map((report) => (
                  <div
                    key={report.id}
                    className="bg-gray-700 rounded-xl p-4 hover:bg-gray-650 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            report.type === 'flood' ? 'bg-blue-100 text-blue-700' :
                            report.type === 'outage' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {report.type === 'flood' ? '🌊 Ngập lụt' : report.type === 'outage' ? '⚡ Mất điện' : '⚠️ Khác'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            report.severity === 'high' ? 'bg-red-100 text-red-700' :
                            report.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {report.severity === 'high' ? '🔴 Cao' : report.severity === 'medium' ? '🟡 TB' : '🟢 Thấp'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            report.status === 'new' ? 'bg-purple-100 text-purple-700' :
                            report.status === 'investigating' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {report.status === 'new' ? '🆕 Mới' : report.status === 'investigating' ? '🔍 Đang xử lý' : '✅ Đã xử lý'}
                          </span>
                          {report.voteScore !== undefined && (
                            <span className="text-gray-400 text-sm">
                              👍 {report.voteScore}
                            </span>
                          )}
                          {report.adminApproved && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                              ✅ Đã duyệt
                            </span>
                          )}
                          {report.zoneCreated && !report.adminApproved && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                              🔥 Tự động
                            </span>
                          )}
                        </div>
                        <p className="text-white font-medium mb-1">{report.description}</p>
                        <p className="text-gray-400 text-sm">
                          {report.reporterName || 'Ẩn danh'} • {new Date(report.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {!report.zoneCreated && !report.adminApproved && (
                          <button
                            onClick={() => handleApproveReport(report.id)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded-lg transition-colors"
                            title="Phê duyệt và tạo khu vực"
                          >
                            <FontAwesomeIcon icon={faCheck} />
                            <span className="ml-1 text-xs font-bold">Duyệt</span>
                          </button>
                        )}
                        {report.status === 'new' && (
                          <button
                            onClick={() => handleUpdateReportStatus(report.id, 'investigating')}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                            title="Đang xử lý"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                        )}
                        {report.status !== 'resolved' && (
                          <button
                            onClick={() => handleUpdateReportStatus(report.id, 'resolved')}
                            className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"
                            title="Đã xử lý"
                          >
                            <FontAwesomeIcon icon={faCheck} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Zones Management */}
        <div className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <FontAwesomeIcon icon={faMap} />
                Quản Lý Khu Vực ({zones.length})
              </h2>
              <div className="flex gap-3 text-white text-sm">
                <span className="bg-white/20 px-3 py-1 rounded-lg">
                  🌊 {zones.filter(z => z.type === 'flood').length} Ngập
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-lg">
                  ⚡ {zones.filter(z => z.type === 'outage').length} Mất điện
                </span>
              </div>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Đang tải...</div>
            ) : zones.length === 0 ? (
              <div className="text-center py-12 text-gray-400">Chưa có khu vực nào</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="bg-gray-700 rounded-xl p-4 hover:bg-gray-650 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        zone.type === 'flood' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {zone.type === 'flood' ? '🌊 Ngập lụt' : '⚡ Mất điện'}
                      </span>
                      {zone.riskLevel !== undefined && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          zone.riskLevel >= 8 ? 'bg-red-100 text-red-700' :
                          zone.riskLevel >= 5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          ⚠️ {zone.riskLevel}/10
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-bold mb-1">{zone.title || 'Khu vực chưa đặt tên'}</h3>
                    {zone.description && (
                      <p className="text-gray-400 text-sm mb-3">{zone.description}</p>
                    )}
                    <button
                      onClick={() => handleDeleteZone(zone.id)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      Xóa khu vực
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
