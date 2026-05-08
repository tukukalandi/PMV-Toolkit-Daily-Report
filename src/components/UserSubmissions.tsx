import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { PMVReport } from '../types/report';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Search, Loader2, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateToDMY } from '../lib/dateUtils';

export default function UserSubmissions() {
  const [reports, setReports] = useState<PMVReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.email) return;

    const path = 'reports';
    const q = query(
      collection(db, path),
      where('createdByEmail', '==', auth.currentUser.email),
      orderBy('reportDate', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PMVReport[];
      setReports(data);
      setLoading(false);
    }, (error: any) => {
      console.error("User submissions fetch error:", error);
      const message = error.message ? (error.message.startsWith('{') ? JSON.parse(error.message).error : error.message) : 'Unknown error occurred';
      toast.error(`History fetch failed: ${message}`);
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto p-4 space-y-6"
    >
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Submissions</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-indiapost-red font-bold">Your Recent Reporting History</p>
        </div>
        <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Logged in as:</span>
          <span className="ml-2 text-xs font-mono font-bold text-slate-700">{auth.currentUser?.email}</span>
        </div>
      </div>

      <Card className="border-slate-200 overflow-hidden shadow-lg border-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 text-slate-600">
              <TableRow>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest py-5 pl-6">Date</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Office Name</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Opening</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Received</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Delivered</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Pending</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest pr-6">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-indiapost-red" />
                      <span className="text-sm font-medium text-slate-500">Loading your history...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-slate-400 italic">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardCheck className="w-12 h-12 text-slate-200" />
                      <p>You haven't submitted any reports yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                    <TableCell className="font-bold text-slate-800 pl-6">{formatDateToDMY(report.reportDate)}</TableCell>
                    <TableCell className="font-medium text-slate-600">{report.officeName}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{report.openingBalance}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-blue-600">+{report.articlesReceived}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-green-600">-{report.articlesDelivered}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-black ${report.articlesPending > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      {report.articlesPending}
                    </TableCell>
                    <TableCell className="pr-6">
                      <span className="text-[11px] text-slate-500 block max-w-[200px] truncate" title={report.pendingReason}>
                        {report.pendingReason || '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      <p className="text-[10px] text-slate-400 text-center font-medium">
        Showing last 20 submissions. Contact administrator for older records.
      </p>
    </motion.div>
  );
}
