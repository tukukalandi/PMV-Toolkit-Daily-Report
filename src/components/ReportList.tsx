import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { PMVReport } from '@/types/report';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, Filter, Search, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportList() {
  const [reports, setReports] = useState<PMVReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = 'reports';
    const q = query(
      collection(db, path),
      orderBy('reportDate', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PMVReport[];
      setReports(data);
      setLoading(false);
    }, (error) => {
      // If we get a permission denied here, it's likely because the user is not an admin
      if (error && (error as any).code === 'permission-denied') {
        console.warn('Access denied: Admin privileges required to view history.');
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const exportToCSV = () => {
    if (reports.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Office Name', 'Opening Balance', 'Received', 'Delivered', 'Pending', 'Reason'];
    const csvRows = [
      headers.join(','),
      ...reports.map(r => [
        r.reportDate,
        `"${r.officeName}"`,
        r.openingBalance,
        r.articlesReceived,
        r.articlesDelivered,
        r.articlesPending,
        `"${r.pendingReason.replace(/"/g, '""')}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `PMV_Report_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Report exported to CSV. You can open this in Google Sheets!');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto p-4 space-y-6"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Report History</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-indiapost-red font-bold mt-1">Archived Submissions / Audit Trail</p>
        </div>
        <Button 
          onClick={exportToCSV}
          variant="outline" 
          className="border-indiapost-red text-indiapost-red hover:bg-indiapost-red hover:text-white transition-all gap-2 font-bold px-6 border-2"
        >
          <Download className="w-4 h-4" />
          Export to Sheets (CSV)
        </Button>
      </div>

      <Card className="border-slate-200 overflow-hidden shadow-lg selection:bg-indiapost-yellow selection:text-indiapost-red">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-b-2 border-slate-200">
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 py-4">Date</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 py-4">Office</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 py-4 text-right">Opening</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 py-4 text-right">Received</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 py-4 text-right">Delivered</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 py-4 text-right">Pending</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 py-4">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400 font-serif italic">
                    No reports found. Submit your first daily report above.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-mono text-xs">{report.reportDate}</TableCell>
                    <TableCell className="font-medium">{report.officeName}</TableCell>
                    <TableCell className="text-right font-mono">{report.openingBalance}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">+{report.articlesReceived}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">-{report.articlesDelivered}</TableCell>
                    <TableCell className={`text-right font-mono font-bold ${report.articlesPending > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      {report.articlesPending}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-slate-500" title={report.pendingReason}>
                      {report.pendingReason || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </motion.div>
  );
}
