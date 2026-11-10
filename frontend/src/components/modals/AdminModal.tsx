/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import {
  useGetAdminUsersQuery,
  useCreateEmployeeMutation,
  useUpdateUserStatusMutation,
  useUpdateUserRoleMutation,
  useGetAuditLogsQuery,
  useGetDepartmentsQuery,
  useGetRolesQuery,
  useGetSqlServerStatusQuery,
  useTestSqlConnectionMutation,
  useInitSqlServerSchemaMutation,
  useInstallStoredProceduresMutation,
  useSyncSqlServerDataMutation,
} from '../../features/api/apiSlice.ts';
import { UserAvatar } from '../common/UserAvatar.tsx';
import type { UserRole } from '../../types/index.ts';
import {
  Shield,
  Users,
  FileText,
  Server,
  Database,
  X,
  UserPlus,
  Power,
  Copy,
  Check,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const AdminModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const lanServerIp = useAppSelector((state) => state.auth.lanServerIp);
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'iis' | 'sql'>('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSqlCode, setCopiedSqlCode] = useState(false);

  // SQL Server management state
  const { data: sqlStatusData, refetch: refetchSqlStatus } = useGetSqlServerStatusQuery();
  const [testSql, { isLoading: isTestingSql }] = useTestSqlConnectionMutation();
  const [initSchema, { isLoading: isInitSchema }] = useInitSqlServerSchemaMutation();
  const [installSp, { isLoading: isInstallingSp }] = useInstallStoredProceduresMutation();
  const [syncData, { isLoading: isSyncingData }] = useSyncSqlServerDataMutation();
  const [sqlTestResult, setSqlTestResult] = useState<any | null>(null);
  const [sqlActionMessage, setSqlActionMessage] = useState<string | null>(null);

  // New Employee Form State
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Employee');
  const [newDeptId, setNewDeptId] = useState<number>(0);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: usersData, isLoading: isUsersLoading } = useGetAdminUsersQuery();
  const { data: auditData, isLoading: isAuditLoading } = useGetAuditLogsQuery();
  const { data: deptsData } = useGetDepartmentsQuery();
  const { data: rolesData, isLoading: isRolesLoading } = useGetRolesQuery();

  const [createEmployee, { isLoading: isCreatingUser }] = useCreateEmployeeMutation();
  const [updateUserStatus] = useUpdateUserStatusMutation();
  const [updateUserRole] = useUpdateUserRoleMutation();

  const isSuperAdmin = currentUser?.role === 'Super Admin';
  const users = usersData?.users || [];
  const logs = auditData?.logs || [];
  const departments = deptsData?.departments || [];
  const roles = (rolesData?.roles || []).filter(
    (role) => isSuperAdmin || role.name !== 'Super Admin'
  );

  useEffect(() => {
    if (departments.length > 0 && !departments.some((department) => department.id === newDeptId)) {
      setNewDeptId(departments[0].id);
    }
  }, [departments, newDeptId]);

  useEffect(() => {
    if (roles.length > 0 && !roles.some((role) => role.name === newRole)) {
      const employeeRole = roles.find((role) => role.name === 'Employee');
      setNewRole((employeeRole || roles[0]).name as UserRole);
    }
  }, [roles, newRole]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormError(null);
      if (!roles.some((role) => role.name === newRole)) {
        setFormError('Select a role available from the server.');
        return;
      }
      await createEmployee({
        username: newUsername,
        name: newName,
        email: newEmail,
        role: newRole,
        departmentId: Number(newDeptId),
        jobTitle: newJobTitle,
        initialPassword: newPassword,
      }).unwrap();

      setShowAddUser(false);
      setNewUsername('');
      setNewName('');
      setNewEmail('');
      setNewJobTitle('');
    } catch (err: any) {
      setFormError(err.data?.error || 'Failed to create employee account');
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await updateUserStatus({ userId, isActive: !currentStatus }).unwrap();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleRoleChange = async (userId: number, role: UserRole) => {
    try {
      await updateUserRole({ userId, role }).unwrap();
    } catch (err) {
      console.error('Failed to change role:', err);
    }
  };

  const sampleWebConfig = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <!-- Enable WebSockets for IIS Application Request Routing -->
    <webSocket enabled="true" />
    <rewrite>
      <rules>
        <!-- Reverse Proxy Socket.IO & WebSocket Upgrades to Node.js backend -->
        <rule name="SocketIO" stopProcessing="true">
          <match url="^socket.io/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/socket.io/{R:1}" />
        </rule>
        <!-- Reverse Proxy REST APIs -->
        <rule name="API" stopProcessing="true">
          <match url="^api/v1/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/api/v1/{R:1}" />
        </rule>
        <!-- React SPA Static Files & Fallback -->
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <ipSecurity allowUnlisted="false">
        <!-- Restrict to corporate LAN Subnet -->
        <add ipAddress="10.1.60.0" subnetMask="255.255.255.0" allowed="true" />
        <add ipAddress="127.0.0.1" allowed="true" />
      </ipSecurity>
    </security>
  </system.webServer>
</configuration>`;

  const copyConfig = () => {
    navigator.clipboard.writeText(sampleWebConfig);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                OfficeConnect Administration & Governance
              </h2>
              <p className="text-[11px] text-slate-500">
                LAN Policy Enforcement · Role-Based Access · Audit Trail
              </p>
            </div>
          </div>
          <button
            onClick={() => dispatch(setActiveModal(null))}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Employee Accounts ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Security Audit Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('iis')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'iis'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Windows IIS & LAN Setup</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'sql'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Server Database</span>
          </button>
        </div>

        {/* Tab 1: Users */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Provisioned LAN Employee Accounts
                </h3>
                <p className="text-[11px] text-slate-400">
                  Deactivated accounts are immediately barred from authenticating on the LAN.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dispatch(setActiveModal('register-employee'))}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open dedicated Super User Registration Portal"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Super User Registration Portal</span>
                </button>
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showAddUser ? 'Hide Form' : 'Quick Add'}</span>
                </button>
              </div>
            </div>

            {/* Add User Drawer / Form */}
            {showAddUser && (
              <form
                onSubmit={handleCreateEmployee}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3"
              >
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Register New Office Employee
                </h4>

                {formError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jordan Hayes"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. jordan.hayes"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      placeholder="jordan.hayes@office.internal"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Department *
                    </label>
                    <select
                      value={newDeptId}
                      onChange={(e) => setNewDeptId(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      required
                    >
                      <option value={0} disabled>Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Systems Engineer"
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Role *
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      disabled={isRolesLoading || roles.length === 0}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.name}>{role.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Initial Password *
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="px-3 py-1 text-xs text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="px-3.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    {isCreatingUser ? 'Registering...' : 'Confirm Account Creation'}
                  </button>
                </div>
              </form>
            )}

            {/* Users Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {u.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                @{u.username} · {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          {isSuperAdmin && !isSelf ? (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                            >
                              {rolesData?.roles.map((role) => (
                                <option key={role.id} value={role.name}>{role.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {u.role}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {u.departmentName}
                        </td>

                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                              u.isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {!isSelf && (
                            <button
                              onClick={() => handleToggleStatus(u.id, u.isActive)}
                              className={`p-1.5 rounded transition-colors ${
                                u.isActive
                                  ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Security & Operational Audit Trails
              </h3>
              <p className="text-[11px] text-slate-400">
                Every login, permission adjustment, group creation, and security event on the LAN is recorded with client IP.
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Actor</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Target</th>
                    <th className="py-2 px-3">Client IP</th>
                    <th className="py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-[11px]">
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 font-sans">
                        {log.userName}
                      </td>
                      <td className="py-2 px-3 text-indigo-600 dark:text-indigo-400">
                        {log.action}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{log.targetResource}</td>
                      <td className="py-2 px-3 text-slate-500">{log.ipAddress}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-sans">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: IIS & LAN Setup */}
        {activeTab === 'iis' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Office LAN Deployment & PC Hosting Specification
                </h3>
                <p className="text-[11px] text-slate-400">
                  Configured Host PC IP: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{lanServerIp}</span> · Subnet: 10.1.60.0/24
                </p>
              </div>
              <button
                onClick={() => dispatch(setActiveModal('deployment'))}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Open Full Deployment Guide</span>
              </button>
            </div>

            {/* Host PC Quick Summary Card */}
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 rounded-lg text-xs space-y-2">
              <p className="font-semibold text-indigo-900 dark:text-indigo-300">
                1. Hosting directly on this PC ({lanServerIp}):
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                <li>
                  <strong>Direct Access URL:</strong>{' '}
                  <code className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                    http://{lanServerIp}:3000
                  </code>
                </li>
                <li>
                  <strong>Client Connection (e.g. from PC 10.1.60.35):</strong> Open browser and navigate to{' '}
                  <code className="font-mono text-slate-800 dark:text-slate-200">http://{lanServerIp}:3000</code>
                </li>
                <li>
                  <strong>Backend Binding:</strong> Express & Socket.IO bind to <code className="font-mono">0.0.0.0:3000</code> to accept LAN clients.
                </li>
              </ul>
            </div>

            {/* Firewall Rule */}
            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                2. Windows Defender Firewall (Run once in Administrator PowerShell on {lanServerIp}):
              </span>
              <pre className="p-3 bg-slate-900 text-slate-200 text-[11px] rounded-lg font-mono overflow-x-auto">
{`New-NetFirewallRule -DisplayName "OfficeConnect Host (Node 3000)" \`
  -Direction Inbound -LocalPort 3000 -Protocol TCP \`
  -Action Allow -RemoteAddress 10.1.60.0/24`}
              </pre>
            </div>

            {/* web.config Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  3. Production web.config (for optional Windows IIS Reverse Proxy):
                </span>
                <button
                  onClick={copyConfig}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy web.config'}</span>
                </button>
              </div>

              <pre className="p-3 bg-slate-900 text-slate-200 text-[11px] rounded-lg overflow-x-auto font-mono max-h-52">
                {sampleWebConfig}
              </pre>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                4. Background Windows Service Setup (PM2):
              </p>
              <pre className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px]">
{`npm install -g pm2 pm2-windows-service
pm2 start server.ts --name "officeconnect" --env production
pm2-service-install`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 4: SQL Server Database */}
        {activeTab === 'sql' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Microsoft SQL Server Connection & Persistence
                </h3>
                <p className="text-[11px] text-slate-400">
                  Enterprise SQL Server integration with automatic background mirroring for employee registrations and audit logs.
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const res = await testSql({}).unwrap();
                    setSqlTestResult(res);
                  } catch (err: any) {
                    setSqlTestResult({ success: false, error: err.data?.error || err.message });
                  }
                }}
                disabled={isTestingSql}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSql ? 'animate-spin' : ''}`} />
                <span>{isTestingSql ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Test Results / Action Banner */}
            {sqlTestResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  sqlTestResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}
              >
                {sqlTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">
                    {sqlTestResult.success
                      ? `Connected to ${sqlTestResult.server}:${sqlTestResult.database} (${sqlTestResult.latencyMs}ms)`
                      : `Connection Standby (${sqlTestResult.server || '10.1.60.8'}:1433)`}
                  </p>
                  <p className="text-[11px] opacity-90">
                    {sqlTestResult.success
                      ? `Server Version: ${sqlTestResult.version}`
                      : `Status: In-memory fallback is active. When your SQL Server service is started on ${lanServerIp}, click 'Test Connection' to verify live connectivity.`}
                  </p>
                </div>
              </div>
            )}

            {sqlActionMessage && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
                {sqlActionMessage}
              </div>
            )}

            {/* Connection Configuration Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Host Server</span>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {sqlStatusData?.config?.server || lanServerIp}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Port</span>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {sqlStatusData?.config?.port || 1433}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Database</span>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {sqlStatusData?.config?.database || 'OfficeConnectDB'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Auth User</span>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {sqlStatusData?.config?.user || 'sa'}
                </span>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Database Operations & Schema Initialization
                </p>
                <p className="text-[11px] text-slate-400">
                  Run DDL tables creation or synchronize local memory directory to SQL Server.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setSqlActionMessage('Initializing SQL Server schemas and tables...');
                      const res = await initSchema().unwrap();
                      setSqlActionMessage(res.message || 'Schema created successfully!');
                    } catch (err: any) {
                      setSqlActionMessage(`Schema Init Notice: ${err.data?.error || err.message}`);
                    }
                  }}
                  disabled={isInitSchema}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 inline mr-1" />
                  <span>{isInitSchema ? 'Creating...' : 'Initialize Schema'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setSqlActionMessage('Compiling and installing Stored Procedures (SPs)...');
                      const res = await installSp().unwrap();
                      setSqlActionMessage(res.message || 'Stored procedures deployed successfully!');
                    } catch (err: any) {
                      setSqlActionMessage(`SP Install Notice: ${err.data?.error || err.message}`);
                    }
                  }}
                  disabled={isInstallingSp}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md transition-colors cursor-pointer"
                >
                  <Database className={`w-3 h-3 inline mr-1 ${isInstallingSp ? 'animate-spin' : ''}`} />
                  <span>{isInstallingSp ? 'Deploying SPs...' : 'Deploy Stored Procedures'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setSqlActionMessage('Synchronizing employees and audit logs to SQL Server...');
                      const res = await syncData().unwrap();
                      setSqlActionMessage(res.message || 'Synced successfully!');
                    } catch (err: any) {
                      setSqlActionMessage(`Sync Notice: ${err.data?.error || err.message}`);
                    }
                  }}
                  disabled={isSyncingData}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 inline mr-1 ${isSyncingData ? 'animate-spin' : ''}`} />
                  <span>{isSyncingData ? 'Syncing...' : 'Sync Data to DB'}</span>
                </button>
              </div>
            </div>

            {/* Stored Procedures Reference Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-500" />
                  Encapsulated Stored Procedures (SPs) in SQL Server
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  database/migrations/003_stored_procedures.sql
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                      [Auth].[sp_RegisterEmployee]
                    </span>
                    <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                      Transactional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Validates duplicates, creates employee, assigns role, auto-enrolls in #general-announcements, and writes immutable audit log.
                  </p>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                      [Chat].[sp_CreateMessage]
                    </span>
                    <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                      Idempotent
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Stores chat messages, checks idempotency keys to prevent duplicate network retries, and updates conversation timestamps.
                  </p>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-[11px]">
                      [Chat].[sp_CreateConversation]
                    </span>
                    <span className="text-[9px] bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded">
                      Deduplicating
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Creates direct or team channels, prevents duplicate 1-to-1 conversation creation, and binds creator and members.
                  </p>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                      [Chat].[sp_ToggleReaction]
                    </span>
                    <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                      Atomic
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Atomically adds or removes emoji reactions for a message per user without race conditions.
                  </p>
                </div>
              </div>
            </div>

            {/* SQL Server Integration Code Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Calling Stored Procedures via Node.js (`request.execute()`):
                </span>
                <button
                  onClick={() => {
                    const snippet = `const sql = require("mssql");

                      // 1. Execute SP to Register Employee
                      async function registerEmployee(employee) {
                        const pool = await sql.connect(config);
                        const result = await pool.request()
                          .input("EmployeeId", sql.NVarChar(50), employee.employeeId)
                          .input("Username", sql.NVarChar(50), employee.username)
                          .input("FullName", sql.NVarChar(150), employee.fullName)
                          .input("Email", sql.NVarChar(150), employee.email)
                          .input("PasswordHash", sql.NVarChar(255), employee.passwordHash)
                          .input("DepartmentId", sql.NVarChar(50), employee.departmentId)
                          .input("JobTitle", sql.NVarChar(100), employee.jobTitle)
                          .execute("[Auth].[sp_RegisterEmployee]");

                        return result.recordset[0];
                      }

                      // 2. Execute SP to Send Chat Message
                      async function sendMessage(msg) {
                        const pool = await sql.connect(config);
                        const result = await pool.request()
                          .input("ConversationId", sql.NVarChar(50), msg.conversationId)
                          .input("SenderId", sql.NVarChar(50), msg.senderId)
                          .input("Content", sql.NVarChar(sql.MAX), msg.content)
                          .input("IdempotencyId", sql.NVarChar(100), msg.idempotencyId)
                          .execute("[Chat].[sp_CreateMessage]");

                        return result.recordset[0];
                      }`;
                    navigator.clipboard.writeText(snippet);
                    setCopiedSqlCode(true);
                    setTimeout(() => setCopiedSqlCode(false), 2000);
                  }}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {copiedSqlCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSqlCode ? 'Copied' : 'Copy SP Execution Code'}</span>
                </button>
              </div>

              <pre className="p-3 bg-slate-900 text-slate-200 text-[11px] rounded-lg overflow-x-auto font-mono max-h-60">
                {`// 1. Register Employee via Stored Procedure
                const res1 = await pool.request()
                  .input('EmployeeId', sql.NVarChar(50), 'EMP-042')
                  .input('Username', sql.NVarChar(50), 'elena.rostova')
                  .input('FullName', sql.NVarChar(150), 'Elena Rostova')
                  .input('Email', sql.NVarChar(150), 'elena.rostova@office.internal')
                  .input('PasswordHash', sql.NVarChar(255), passwordHash)
                  .input('RoleName', sql.NVarChar(50), 'Employee')
                  .input('DepartmentId', sql.NVarChar(50), 'dept-it')
                  .input('JobTitle', sql.NVarChar(100), 'Security Analyst')
                  .execute('[Auth].[sp_RegisterEmployee]');

                // 2. Store Chat Message via Stored Procedure
                const res2 = await pool.request()
                  .input('ConversationId', sql.NVarChar(50), 'conv-general')
                  .input('SenderId', sql.NVarChar(50), 'usr-sarah')
                  .input('Content', sql.NVarChar(sql.MAX), 'Hello internal LAN team!')
                  .input('IdempotencyId', sql.NVarChar(100), 'idemp-994')
                  .execute('[Chat].[sp_CreateMessage]');`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
