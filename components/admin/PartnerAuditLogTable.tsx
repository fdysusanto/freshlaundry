'use client';

import React from 'react';
import { AuditLogRecord } from '@/types/laundry';
import { Shield, Clock, User, FileText, Lock } from 'lucide-react';

interface PartnerAuditLogTableProps {
  logs: AuditLogRecord[];
  isLoading?: boolean;
}

export const PartnerAuditLogTable: React.FC<PartnerAuditLogTableProps> = ({
  logs,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200">
        Memuat data audit log...
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
        <Shield className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="font-bold text-slate-700">Belum Ada Catatan Audit Log</p>
        <p className="text-[11px] text-slate-500">
          Semua perubahan sensitif pada partner dari sisi Platform Ops Admin akan tercatat secara immutable di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
        <span className="font-bold text-slate-700 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-600" /> Audit Log Platform (Immutable)
        </span>
        <span>Total {logs.length} Catatan Perubahan</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Aktor / Role</th>
                <th className="py-3 px-4">Tindakan / Action</th>
                <th className="py-3 px-4">Perubahan State</th>
                <th className="py-3 px-4">Alasan Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {logs.map((log) => {
                const dateStr = new Date(log.timestamp).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{dateStr}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-600" />
                        <div>
                          <p className="font-bold text-slate-900 text-[11px]">{log.actorName || 'Platform Ops Admin'}</p>
                          <span className="inline-block px-1.5 py-0.2 bg-purple-100 text-purple-700 text-[9px] rounded-md font-bold uppercase">
                            {log.actor_role}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-md font-bold font-mono text-[10px] border ${
                        log.action === 'SERVICE_CREATED' || log.action === 'SERVICE_ACTIVATED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : log.action === 'SERVICE_DEACTIVATED'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : log.action === 'SERVICE_UPDATED'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-brand-surface text-brand-primary border-brand-primary/20'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {log.before_value || log.after_value ? (
                        <div className="space-y-0.5">
                          {log.before_value && (
                            <p className="text-slate-500 line-through text-[10px]">
                              Sebelum: {JSON.stringify(log.before_value)}
                            </p>
                          )}
                          {log.after_value && (
                            <p className="font-bold text-slate-900 text-[10px]">
                              Sesudah: {JSON.stringify(log.after_value)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-[11px] max-w-xs">
                      {log.reason ? (
                        <div className="flex items-start gap-1">
                          <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span>{log.reason}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-italic">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
