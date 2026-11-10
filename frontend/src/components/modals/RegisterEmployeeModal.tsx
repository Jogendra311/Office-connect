/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import {
  useRegisterEmployeeMutation,
  useGetDepartmentsQuery,
  useGetRolesQuery,
} from '../../features/api/apiSlice.ts';
import type { UserRole } from '../../types/index.ts';
import {
  ShieldCheck,
  UserPlus,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  BadgeCheck,
  Sparkles,
} from 'lucide-react';

export const RegisterEmployeeModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const lanServerIp = useAppSelector((state) => state.auth.lanServerIp);

  const { data: deptsData } = useGetDepartmentsQuery();
  const { data: rolesData, isLoading: isRolesLoading } = useGetRolesQuery();
  const departments = deptsData?.departments || [];
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  const roles = (rolesData?.roles || []).filter(
    (availableRole) => isSuperAdmin || availableRole.name !== 'Super Admin'
  );

  const [registerEmployee, { isLoading }] = useRegisterEmployeeMutation();

  // New Employee Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState<number>(0);
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<UserRole>('Employee');
  const [initialPassword, setInitialPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (departments.length > 0 && !departments.some((department) => department.id === departmentId)) {
      setDepartmentId(departments[0].id);
    }
  }, [departments, departmentId]);

  useEffect(() => {
    if (roles.length > 0 && !roles.some((availableRole) => availableRole.name === role)) {
      const employeeRole = roles.find((availableRole) => availableRole.name === 'Employee');
      setRole((employeeRole || roles[0]).name as UserRole);
    }
  }, [roles, role]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!username || username === name.toLowerCase().replace(/\s+/g, '.')) {
      const slug = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '.');
      setUsername(slug);
      setEmail(slug ? `${slug}@office.internal` : '');
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = 'Off!';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInitialPassword(res);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !username.trim() || !email.trim() || !jobTitle.trim()) {
      setError('Please fill in all required employee fields.');
      return;
    }

    if (!initialPassword) {
      setError('An initial password is required.');
      return;
    }

    if (!departmentId) {
      setError('Select a department.');
      return;
    }

    if (!roles.some((availableRole) => availableRole.name === role)) {
      setError('Select a role available from the server.');
      return;
    }

    try {
      const payload = {
        employeeId: Number(employeeId) || Math.floor(1000 + Math.random() * 9000),
        username: username.toLowerCase().trim(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        departmentId: Number(departmentId) || 1,
        jobTitle: jobTitle.trim(),
        initialPassword,
      };

      const res = await registerEmployee(payload).unwrap();
      setCreatedUser(res.user);
    } catch (err: any) {
      setError(
        err.data?.error ||
          err.message ||
          'Failed to register employee. Please check the account details and try again.'
      );
    }
  };

  const handleCopyCredentials = () => {
    if (!createdUser) return;
    const text = `OfficeConnect LAN Access Credentials:
Name: ${createdUser.name}
Username: ${createdUser.username}
Corporate Email: ${createdUser.email}
Employee ID: ${createdUser.employeeId}
Role: ${createdUser.role}
Department: ${createdUser.departmentName}
LAN Portal: http://${lanServerIp}:3000
Initial Password: ${initialPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetForNext = () => {
    setCreatedUser(null);
    setName('');
    setUsername('');
    setEmail('');
    setJobTitle('');
    setEmployeeId(`EMP-${Math.floor(100 + Math.random() * 900)}`);
    setInitialPassword('');
    setError(null);
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md select-none overflow-y-auto">
      <div className="w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-6 animate-chat-transition">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-white/40 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/30">
              <ShieldCheck className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Register Employee
                </h2>
                {/* <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300 border border-blue-500/20 backdrop-blur-xs uppercase tracking-wider">
                  Super User Portal
                </span> */}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Provision new corporate LAN employee credentials and department access.
              </p>
            </div>
          </div>
          <button
            onClick={() => dispatch(setActiveModal(null))}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-200/60 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {createdUser ? (
            /* Success State */
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Employee Account Provisioned Successfully
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Account is active and ready for sign-in.
                  </p>
                </div>
              </div>

              {/* Credentials Summary Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4 text-indigo-500" />
                    New Employee Credentials
                  </span>
                  <button
                    onClick={handleCopyCredentials}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied to Clipboard' : 'Copy Credentials'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Full Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {createdUser.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Employee ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {createdUser.employeeId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Username</span>
                    <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {createdUser.username}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Corporate Email</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                      {createdUser.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Department & Role</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {createdUser.departmentName} · {createdUser.role}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Initial Password</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-900 px-2 py-0.5 rounded text-[11px]">
                      {initialPassword}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetForNext}
                  className="px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer"
                >
                  Register Another Employee
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setActiveModal(null))}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* New Employee Details */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
                  New Employee Directory Information
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Marcus Brody"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. EMP-042"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="e.g. marcus.brody"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Corporate Email *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="marcus.brody@office.internal"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Department *
                    </label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
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
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Systems Engineer"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      System Role *
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                      disabled={isRolesLoading || roles.length === 0}
                    >
                       <option value={0} disabled>Select role</option>
                      {roles.map((availableRole) => (
                        <option key={availableRole.id} value={availableRole.name}>
                          {availableRole.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Initial Temporary Password
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        Generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={initialPassword}
                        onChange={(e) => setInitialPassword(e.target.value)}
                        placeholder="Set an initial password"
                        className="w-full pl-3 pr-8 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice */}
              <p className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                Newly registered employees are immediately assigned to the company-wide General Announcement channel and granted access to their department team channel.
              </p>

              {/* Submit / Cancel */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => dispatch(setActiveModal(null))}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isLoading ? 'Authorizing & Creating...' : 'Authorize & Register Employee'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
