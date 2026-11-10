/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { setActiveModal } from '../../features/chat/chatSlice.ts';
import { useLazyGetHealthQuery } from '../../features/api/apiSlice.ts';
import {
  Server,
  X,
  Check,
  Copy,
  Terminal,
  ShieldCheck,
  Laptop,
  Network,
  Activity,
  Flame,
  Globe,
} from 'lucide-react';

export const DeploymentModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const lanServerIp = useAppSelector((state) => state.auth.lanServerIp);
  const isConnected = useAppSelector((state) => state.chat.isNetworkConnected);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quick' | 'firewall' | 'client' | 'iis'>('quick');
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [getHealth, { isFetching: isTestingHealth }] = useLazyGetHealthQuery();

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const testHealthEndpoint = async () => {
    try {
      const data = await getHealth().unwrap();
      setHealthStatus(`Online (${data.status}) - Host: ${data.hostIp || 'available'}`);
    } catch {
      setHealthStatus('Health endpoint unavailable');
    }
  };

  const directUrl = `http://${lanServerIp}:3000`;
  const healthUrl = `http://${lanServerIp}:3000/api/v1/health`;
  const socketUrl = `ws://${lanServerIp}:3000/socket.io/`;

  const firewallNodeCmd = `New-NetFirewallRule -DisplayName "OfficeConnect Host (Node 3000)" \`
    -Direction Inbound -LocalPort 3000 -Protocol TCP \`
    -Action Allow -RemoteAddress 10.1.60.0/24`;

  const firewallIisCmd = `New-NetFirewallRule -DisplayName "OfficeConnect Web HTTP/HTTPS" \`
    -Direction Inbound -LocalPort 80,443 -Protocol TCP \`
    -Action Allow -RemoteAddress 10.1.60.0/24`;

  const clientTestCmd = `Test-NetConnection -ComputerName ${lanServerIp} -Port 3000`;

  const sampleWebConfig = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <!-- Enable WebSockets for IIS Application Request Routing -->
    <webSocket enabled="true" />
    <rewrite>
      <rules>
        <!-- Reverse Proxy Socket.IO & WebSocket Upgrades to Node.js backend on ${lanServerIp} -->
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
      <!-- Restrict to corporate LAN Subnet 10.1.60.0/24 -->
      <ipSecurity allowUnlisted="false">
        <add ipAddress="10.1.60.0" subnetMask="255.255.255.0" allowed="true" />
        <add ipAddress="127.0.0.1" allowed="true" />
      </ipSecurity>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="26214400" />
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  OfficeConnect Deployment & LAN Host Guide
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  Host: {lanServerIp}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                LAN Subnet: 10.1.60.0/24 (Client Range: 10.1.60.1 – 10.1.60.254)
              </p>
            </div>
          </div>
          <button
            onClick={() => dispatch(setActiveModal(null))}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Network Host Banner */}
        <div className="px-5 py-3 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/30 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">
                Hosting PC Address
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {lanServerIp}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">
                Authorized Subnet
              </span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                10.1.60.0/24 (255.255.255.0)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">
                Network Status
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {isConnected ? 'LAN Online & Ready' : 'Verifying Network...'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-6 text-xs font-medium bg-slate-50/50 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('quick')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'quick'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Host on Your PC ({lanServerIp})</span>
          </button>

          <button
            onClick={() => setActiveTab('client')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'client'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Colleague Access (e.g. 10.1.60.35)</span>
          </button>

          <button
            onClick={() => setActiveTab('firewall')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'firewall'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Windows Firewall Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('iis')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'iis'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>IIS & Service Setup</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: Host on Your PC */}
          {activeTab === 'quick' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  How hosting works from your PC ({lanServerIp}):
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  When you run OfficeConnect on your machine, the Express and Socket.IO server binds to <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono">0.0.0.0:3000</code>. This means any computer connected to the same office network (<code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono">10.1.60.0/24</code>) can reach this app directly using your PC IP <code className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold font-mono">{lanServerIp}</code>.
                </p>
              </div>

              {/* Endpoints Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 text-xs">
                  Active Endpoints for Host PC {lanServerIp}
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
                  <div className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Main Web Application:</span>
                      <p className="text-slate-500 font-mono text-[11px] mt-0.5">{directUrl}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(directUrl, 'directUrl')}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'directUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'directUrl' ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>

                  <div className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Real-time Socket.IO Gateway:</span>
                      <p className="text-slate-500 font-mono text-[11px] mt-0.5">{socketUrl}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(socketUrl, 'socketUrl')}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'socketUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'socketUrl' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Health Check & Diagnostic API:</span>
                      <p className="text-slate-500 font-mono text-[11px] mt-0.5">{healthUrl}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={testHealthEndpoint}
                        disabled={isTestingHealth}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>{isTestingHealth ? 'Pinging...' : 'Test Health'}</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(healthUrl, 'healthUrl')}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedKey === 'healthUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'healthUrl' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {healthStatus && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{healthStatus}</span>
                </div>
              )}

              {/* Startup Commands */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Startup commands to run on your PC ({lanServerIp}):
                </span>
                <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] space-y-1">
                  <p className="text-slate-400"># 1. Install dependencies (first time only):</p>
                  <p className="text-emerald-400">npm install</p>
                  <p className="text-slate-400 mt-2"># 2. Start the LAN Server (Development):</p>
                  <p className="text-emerald-400">npm run dev</p>
                  <p className="text-slate-400 mt-2"># 3. Or Build & Run as Full Production Service:</p>
                  <p className="text-emerald-400">npm run build</p>
                  <p className="text-emerald-400">npm start</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Colleague Access (e.g. 10.1.60.35) */}
          {activeTab === 'client' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 rounded-lg space-y-2">
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-300">
                  Connecting Colleague Workstations (e.g., PC 10.1.60.35) to Your PC ({lanServerIp})
                </h4>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Colleagues on any workstation within <code className="font-mono">10.1.60.0/24</code> can use the chat system without installing Node.js. They only need a web browser (Chrome, Edge, Firefox).
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px]">1</span>
                    <span>Colleague opens browser on their machine (e.g. 10.1.60.35):</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded font-mono text-[11px]">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{directUrl}</span>
                    <button
                      onClick={() => copyToClipboard(directUrl, 'clientUrl')}
                      className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {copiedKey === 'clientUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'clientUrl' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px]">2</span>
                    <span>Colleague signs in with their employee credentials:</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                    Employee accounts are loaded from the backend directory. Create accounts in the Employee Accounts tab.
                  </p>
                </div>

                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px]">3</span>
                    <span>If a colleague cannot connect, test connectivity from their PowerShell:</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-900 text-slate-200 rounded font-mono text-[11px]">
                    <span className="text-amber-400">{clientTestCmd}</span>
                    <button
                      onClick={() => copyToClipboard(clientTestCmd, 'testCmd')}
                      className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {copiedKey === 'testCmd' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'testCmd' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-7">
                    If <code className="font-mono">TcpTestSucceeded : False</code>, apply the Windows Firewall rule in the next tab on your PC ({lanServerIp}).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Windows Firewall Rules */}
          {activeTab === 'firewall' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-lg space-y-1.5">
                <h4 className="font-semibold text-amber-900 dark:text-amber-300">
                  Critical: Windows Defender Firewall Configuration on {lanServerIp}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  By default, Windows blocks incoming network connections on port 3000 from other computers. Run this command once in <strong>PowerShell (Run as Administrator)</strong> on your PC ({lanServerIp}) to allow other machines on <code className="font-mono font-bold">10.1.60.0/24</code> to connect:
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Rule 1: Direct Node Port 3000 for LAN Subnet
                  </span>
                  <button
                    onClick={() => copyToClipboard(firewallNodeCmd, 'fwNode')}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'fwNode' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'fwNode' ? 'Copied' : 'Copy PowerShell Command'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {firewallNodeCmd}
                </pre>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Rule 2: HTTP/HTTPS (Port 80/443) if using IIS Reverse Proxy
                  </span>
                  <button
                    onClick={() => copyToClipboard(firewallIisCmd, 'fwIis')}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'fwIis' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'fwIis' ? 'Copied' : 'Copy PowerShell Command'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {firewallIisCmd}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: IIS & Service Setup */}
          {activeTab === 'iis' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                  Optional: Production IIS Reverse Proxy on Host {lanServerIp}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  If hosting through Windows Internet Information Services (IIS) on port 80/443 with URL Rewrite & Application Request Routing (ARR):
                </p>
              </div>

              {/* web.config */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Production web.config (Place in IIS Web Root / wwwroot):
                  </span>
                  <button
                    onClick={() => copyToClipboard(sampleWebConfig, 'webConfig')}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'webConfig' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'webConfig' ? 'Copied' : 'Copy web.config'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] max-h-56 overflow-y-auto overflow-x-auto">
                  {sampleWebConfig}
                </pre>
              </div>

              {/* PM2 Service Setup */}
              <div className="space-y-1.5 pt-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Run as Persistent Background Service (PM2 on Windows):
                </span>
                <pre className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px]">
{`npm install -g pm2 pm2-windows-service
pm2 start server.ts --name "officeconnect" --env production
pm2-service-install`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 text-xs">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <Terminal className="w-3.5 h-3.5" />
            <span>Configured Server Host: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{lanServerIp}</span></span>
          </div>
          <button
            onClick={() => dispatch(setActiveModal(null))}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium rounded-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
