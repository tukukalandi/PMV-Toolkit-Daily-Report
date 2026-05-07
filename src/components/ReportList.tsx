import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PMVReport } from '../types/report';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Download, Search, Calendar, Trash2, Edit2, CheckCircle2, XCircle, AlertCircle, RefreshCw, X, Loader2, FileSpreadsheet, FileText as FilePdf } from 'lucide-react';
import { toast } from 'sonner';
import { OFFICES } from '../constants/offices';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export default function ReportList() {
  const [reports, setReports] = useState<PMVReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('reports');
  
  // Edit State
  const [editingReport, setEditingReport] = useState<PMVReport | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const path = 'reports';
    const q = query(
      collection(db, path),
      where('reportDate', '==', selectedDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PMVReport[];
      setReports(data);
      setLoading(false);
    }, (error) => {
      if (error && (error as any).code === 'permission-denied') {
        console.warn('Access denied: Admin privileges required to view history.');
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const stats = useMemo(() => {
    const submittedCount = reports.length;
    const totalOffices = OFFICES.length;
    const pendingCount = Math.max(0, totalOffices - submittedCount);
    const submittedOfficesSet = new Set(reports.map(r => r.officeName));
    const pendingOffices = OFFICES.filter(o => !submittedOfficesSet.has(o));

    return {
      submittedCount,
      totalOffices,
      pendingCount,
      pendingOffices,
      percentage: Math.round((submittedCount / totalOffices) * 100) || 0
    };
  }, [reports]);

  const handleDelete = async (id: string, officeName: string) => {
    if (!window.confirm(`Are you sure you want to delete the report for ${officeName}?`)) return;

    try {
      await deleteDoc(doc(db, 'reports', id));
      toast.success('Report deleted successfully');
    } catch (error) {
      toast.error('Failed to delete report');
      console.error(error);
    }
  };

  const handleEditSave = async () => {
    if (!editingReport) return;
    setEditLoading(true);

    try {
      const { id, ...data } = editingReport;
      await updateDoc(doc(db, 'reports', id!), {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success('Report updated successfully');
      setEditingReport(null);
    } catch (error) {
      toast.error('Failed to update report');
      console.error(error);
    } finally {
      setEditLoading(false);
    }
  };

  const exportToExcel = (type: 'reports' | 'pending') => {
    const data = type === 'reports' ? reports : stats.pendingOffices.map(o => ({ Office: o, Status: 'Pending' }));
    if (data.length === 0) {
      toast.error(`No ${type} to export`);
      return;
    }

    const ws = XLSX.utils.json_to_sheet(type === 'reports' ? reports.map(r => ({
      Date: r.reportDate,
      Office: r.officeName,
      'Opening Balance': r.openingBalance,
      'Articles Received': r.articlesReceived,
      'Articles Delivered': r.articlesDelivered,
      'Articles Pending': r.articlesPending,
      'Reason': r.pendingReason || ''
    })) : data);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'reports' ? "Daily Submissions" : "Pending Offices");
    XLSX.writeFile(wb, `PMV_${type}_${selectedDate}.xlsx`);
    toast.success(`${type === 'reports' ? 'Submissions' : 'Pending list'} exported to Excel`);
  };

  const exportToPDF = (type: 'reports' | 'pending') => {
    const doc = new jsPDF();
    const title = type === 'reports' ? `PMV Daily Report - ${selectedDate}` : `Pending Reports List - ${selectedDate}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    if (type === 'reports') {
      autoTable(doc, {
        startY: 35,
        head: [['Office', 'Opening', 'Received', 'Delivered', 'Pending', 'Reason']],
        body: reports.map(r => [
          r.officeName,
          r.openingBalance,
          r.articlesReceived,
          r.articlesDelivered,
          r.articlesPending,
          r.pendingReason || '-'
        ]),
        headStyles: { fillColor: [204, 0, 0] }, // India Post Red
      });
    } else {
      autoTable(doc, {
        startY: 35,
        head: [['#', 'Office Name', 'Status']],
        body: stats.pendingOffices.map((o, i) => [i + 1, o, 'Pending']),
        headStyles: { fillColor: [204, 0, 0] },
      });
    }

    doc.save(`PMV_${type}_${selectedDate}.pdf`);
    toast.success(`${type === 'reports' ? 'Submissions' : 'Pending list'} exported to PDF`);
  };

  const exportToCSV = () => {
    if (reports.length === 0) {
      toast.error('No data to export for this date');
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
    link.setAttribute('download', `PMV_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Report exported to CSV');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto p-4 space-y-6"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-indiapost-red font-bold">Consolidated Performance Monitoring</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 h-11 border-slate-200 focus:ring-indiapost-red rounded-xl font-medium"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => exportToExcel('reports')}
              variant="outline" 
              className="h-11 border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-all gap-2 font-bold px-4 border-2 rounded-xl"
              title="Download Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden lg:inline">Excel</span>
            </Button>
            <Button 
              onClick={() => exportToPDF('reports')}
              variant="outline" 
              className="h-11 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all gap-2 font-bold px-4 border-2 rounded-xl"
              title="Download PDF"
            >
              <FilePdf className="w-4 h-4" />
              <span className="hidden lg:inline">PDF</span>
            </Button>
            <Button 
              onClick={exportToCSV}
              variant="outline" 
              className="h-11 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white transition-all gap-2 font-bold px-4 border-2 rounded-xl"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">CSV</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 uppercase tracking-wider">Submitted</p>
                <h3 className="text-4xl font-bold text-slate-900 mt-1">{stats.submittedCount}</h3>
              </div>
              <div className="p-3 bg-green-100 rounded-full text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>
            <div className="mt-4 h-1.5 w-full bg-green-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.percentage}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">{stats.percentage}% of total offices</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 uppercase tracking-wider">Pending</p>
                <h3 className="text-4xl font-bold text-slate-900 mt-1">{stats.pendingCount}</h3>
              </div>
              <div className="p-3 bg-amber-100 rounded-full text-amber-600">
                <AlertCircle className="w-8 h-8" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-6 font-medium">Require follow-up today</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wider">Total Offices</p>
                <h3 className="text-4xl font-bold text-slate-900 mt-1">{stats.totalOffices}</h3>
              </div>
              <div className="p-3 bg-slate-200 rounded-full text-slate-600">
                <RefreshCw className="w-8 h-8" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-6 font-medium">Active reporting units</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 h-12 p-1 bg-slate-100 rounded-xl">
          <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all font-bold">
            All Submissions
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all font-bold">
            Pending ({stats.pendingCount})
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="reports" key="reports-content" className="mt-0">
            <Card className="border-slate-200 overflow-hidden shadow-lg border-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 text-slate-600">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest py-5 pl-6">Office Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Opening</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Received</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Delivered</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Pending</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Reason / Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20">
                          <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indiapost-red"></div>
                            <span className="text-sm font-medium text-slate-500">Loading records...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="w-12 h-12 text-slate-200" />
                            <p>No reports submitted for {selectedDate}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reports.map((report) => (
                        <TableRow key={report.id} className="hover:bg-slate-50/80 transition-colors group border-b border-slate-100 last:border-0">
                          <TableCell className="font-bold text-slate-800 pl-6">{report.officeName}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{report.openingBalance}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-blue-600 font-bold">+{report.articlesReceived}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-green-600 font-bold">-{report.articlesDelivered}</TableCell>
                          <TableCell className={`text-right font-mono text-xs font-black ${report.articlesPending > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {report.articlesPending}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[11px] text-slate-500 max-w-[200px] truncate" title={report.pendingReason}>
                                {report.pendingReason || '—'}
                              </span>
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                  onClick={() => setEditingReport(report)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-indiapost-red hover:bg-red-50"
                                  onClick={() => handleDelete(report.id!, report.officeName)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="pending" key="pending-content" className="mt-0">
            <div className="flex justify-end gap-2 mb-4">
              <Button 
                onClick={() => exportToExcel('pending')}
                size="sm"
                variant="outline" 
                className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white gap-2 font-bold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </Button>
              <Button 
                onClick={() => exportToPDF('pending')}
                size="sm"
                variant="outline" 
                className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white gap-2 font-bold"
              >
                <FilePdf className="w-3.5 h-3.5" />
                PDF
              </Button>
            </div>
            <Card className="border-slate-200 overflow-hidden shadow-lg border-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 text-slate-600">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest py-5 pl-6">Office Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right pr-6">Action Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.pendingOffices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-20 bg-green-50/30 group">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-green-100 rounded-full text-green-600 group-hover:scale-110 transition-transform">
                              <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h4 className="text-lg font-bold text-green-700">All Offices Submitted!</h4>
                            <p className="text-sm text-green-600/80">Excellent work - 100% compliance achieved for {selectedDate}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.pendingOffices.map((office, index) => (
                        <TableRow key={`pending-${office}-${index}`} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                          <TableCell className="font-bold text-slate-700 pl-6">{office}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3" /> Missing
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button variant="ghost" size="sm" className="text-xs text-indiapost-red font-bold hover:bg-red-50">
                              Request Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </AnimatePresence>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingReport} onOpenChange={(open) => !open && setEditingReport(null)}>
        <DialogContent className="max-w-2xl rounded-2xl overflow-hidden p-0 gap-0 border-none shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
            <div>
              <DialogTitle className="text-white text-xl font-bold">Edit Post Report</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs uppercase tracking-widest mt-0.5">{editingReport?.officeName} • {editingReport?.reportDate}</DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-white"
              onClick={() => setEditingReport(null)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {editingReport && (
            <div className="p-8 space-y-6 bg-slate-50">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Opening Balance</Label>
                  <Input 
                    type="number"
                    value={editingReport.openingBalance}
                    onChange={(e) => {
                      const opening = parseInt(e.target.value) || 0;
                      const pending = opening + editingReport.articlesReceived - editingReport.articlesDelivered;
                      setEditingReport({ ...editingReport, openingBalance: opening, articlesPending: pending });
                    }}
                    className="bg-white border-slate-200 h-10 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Articles Received</Label>
                  <Input 
                    type="number"
                    value={editingReport.articlesReceived}
                    onChange={(e) => {
                      const received = parseInt(e.target.value) || 0;
                      const pending = editingReport.openingBalance + received - editingReport.articlesDelivered;
                      setEditingReport({ ...editingReport, articlesReceived: received, articlesPending: pending });
                    }}
                    className="bg-white border-slate-200 h-10 font-mono text-blue-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Articles Delivered</Label>
                  <Input 
                    type="number"
                    value={editingReport.articlesDelivered}
                    onChange={(e) => {
                      const delivered = parseInt(e.target.value) || 0;
                      const pending = editingReport.openingBalance + editingReport.articlesReceived - delivered;
                      setEditingReport({ ...editingReport, articlesDelivered: delivered, articlesPending: pending });
                    }}
                    className="bg-white border-slate-200 h-10 font-mono text-green-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Current Pending</Label>
                  <div className="h-10 flex items-center px-3 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-900">
                    {editingReport.articlesPending}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Reason for Pending / Daily Remarks</Label>
                <Textarea 
                  value={editingReport.pendingReason || ''}
                  onChange={(e) => setEditingReport({ ...editingReport, pendingReason: e.target.value })}
                  className="bg-white border-slate-200 min-h-[100px] resize-none"
                  placeholder="Enter daily remarks or reason for pending articles..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setEditingReport(null)}
                  className="h-11 px-6 border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleEditSave}
                  disabled={editLoading}
                  className="h-11 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 min-w-[140px]"
                >
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Report'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

