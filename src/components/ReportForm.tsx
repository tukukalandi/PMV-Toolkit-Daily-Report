import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatDateToDMY } from '../lib/dateUtils';
import { collection, setDoc, doc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ClipboardList, Send, Loader2, Check, ChevronsUpDown, Search, Package, RefreshCw } from 'lucide-react';
import { OFFICES } from '../constants/offices';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { cn } from "../lib/utils";

export default function ReportForm() {
  const [loading, setLoading] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    officeName: '',
    openingBalance: '',
    articlesReceived: '',
    articlesDelivered: '',
    pendingReason: '',
    reportDate: new Date().toISOString().split('T')[0],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const fetchLatestBalance = async (office: string) => {
    setFetchingBalance(true);
    try {
      const q = query(
        collection(db, 'reports'),
        where('officeName', '==', office),
        orderBy('reportDate', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const lastReport = querySnapshot.docs[0].data();
        setFormData(prev => ({ 
          ...prev, 
          officeName: office,
          openingBalance: lastReport.articlesPending.toString() 
        }));
        toast.info(`Opening balance auto-filled from last report (${formatDateToDMY(lastReport.reportDate)})`);
      } else {
        setFormData(prev => ({ ...prev, officeName: office, openingBalance: '0' }));
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setFormData(prev => ({ ...prev, officeName: office }));
    } finally {
      setFetchingBalance(false);
    }
  };

  const handleOfficeSelect = (currentValue: string) => {
    setOpen(false);
    fetchLatestBalance(currentValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.officeName) {
      toast.error('Please select an office');
      return;
    }

    setLoading(true);
    const path = 'reports';
    try {
      const openingBalance = Number(formData.openingBalance);
      const articlesReceived = Number(formData.articlesReceived);
      const articlesDelivered = Number(formData.articlesDelivered);
      const articlesPending = openingBalance + articlesReceived - articlesDelivered;

      if (articlesPending < 0) {
        toast.error('Invalid calculations: Pending articles cannot be negative.');
        setLoading(false);
        return;
      }

      // Logic check for pending reason
      if (articlesPending > 0 && !formData.pendingReason.trim()) {
        toast.error('Please provide a reason for the pending articles.');
        setLoading(false);
        return;
      }

      // Check if report already exists for this office and date
      const q = query(
        collection(db, path),
        where('officeName', '==', formData.officeName),
        where('reportDate', '==', formData.reportDate),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        toast.error(`A report for ${formData.officeName} on ${formData.reportDate} already exists. Please contact admin if you need to delete or update it.`);
        setLoading(false);
        return;
      }

      // Generate a unique ID to prevent race conditions at DB level
      // format: officeName_YYYY-MM-DD (sanitized)
      const sanitizedOffice = formData.officeName.replace(/[^a-zA-Z0-9]/g, '_');
      const uniqueId = `${sanitizedOffice}_${formData.reportDate}`;

      await setDoc(doc(db, path, uniqueId), {
        officeName: formData.officeName,
        openingBalance,
        articlesReceived,
        articlesDelivered,
        articlesPending,
        pendingReason: formData.pendingReason,
        reportDate: formData.reportDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Report submitted successfully!');
      setFormData({
        officeName: '',
        openingBalance: '',
        articlesReceived: '',
        articlesDelivered: '',
        pendingReason: '',
        reportDate: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const articlesPending = (Number(formData.openingBalance) || 0) + 
                         (Number(formData.articlesReceived) || 0) - 
                         (Number(formData.articlesDelivered) || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto p-4"
    >
      <Card className="border-t-4 border-t-indiapost-red shadow-2xl overflow-hidden border-x border-b border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200 relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Package className="w-24 h-24 text-indiapost-red" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indiapost-red rounded-lg">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">Daily PMV Toolkit Report</CardTitle>
              <CardDescription className="text-slate-500">Official Daily Status Submission Portal</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8 px-6 pb-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="officeName" className="text-sm font-semibold text-slate-700">Name of the Office</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between border-slate-300 hover:border-indiapost-red transition-colors font-normal"
                      >
                        <span>
                          {formData.officeName
                            ? OFFICES.find((office) => office === formData.officeName)
                            : "Search & Select Office..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    }
                  />
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Type office name..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>No office found.</CommandEmpty>
                        <CommandGroup>
                          {OFFICES.map((office, index) => (
                            <CommandItem
                              key={`${office}-${index}`}
                              value={office}
                              onSelect={handleOfficeSelect}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.officeName === office ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {office}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <Label htmlFor="reportDate" className="text-sm font-semibold text-slate-700">Report Date</Label>
                  <span className="text-[10px] font-bold text-indiapost-red bg-red-50 px-2 py-0.5 rounded border border-red-100">
                    {formatDateToDMY(formData.reportDate)}
                  </span>
                </div>
                <Input
                  id="reportDate"
                  name="reportDate"
                  type="date"
                  value={formData.reportDate}
                  onChange={handleChange}
                  required
                  className="border-slate-300 focus-visible:ring-indiapost-red font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3 relative">
                <Label htmlFor="openingBalance" className="text-sm font-semibold text-slate-700">Opening Balance</Label>
                <div className="relative">
                  <Input
                    id="openingBalance"
                    name="openingBalance"
                    type="number"
                    min="0"
                    value={formData.openingBalance}
                    onChange={handleChange}
                    placeholder="0"
                    required
                    className="border-slate-300 focus-visible:ring-indiapost-red pr-10"
                  />
                  {fetchingBalance && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <RefreshCw className="w-4 h-4 text-indiapost-red animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="articlesReceived" className="text-sm font-semibold text-slate-700">Articles Received</Label>
                <Input
                  id="articlesReceived"
                  name="articlesReceived"
                  type="number"
                  min="0"
                  value={formData.articlesReceived}
                  onChange={handleChange}
                  placeholder="0"
                  required
                  className="border-slate-300 focus-visible:ring-indiapost-red"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="articlesDelivered" className="text-sm font-semibold text-slate-700">Articles Delivered</Label>
                <Input
                  id="articlesDelivered"
                  name="articlesDelivered"
                  type="number"
                  min="0"
                  value={formData.articlesDelivered}
                  onChange={handleChange}
                  placeholder="0"
                  required
                  className="border-slate-300 focus-visible:ring-indiapost-red"
                />
              </div>
            </div>

            <div className="p-5 bg-indiapost-yellow/10 rounded-xl border border-indiapost-yellow/30 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indiapost-red/70 mb-1">Stock Status</p>
                <p className="text-sm font-medium text-slate-600">Pending for Delivery</p>
              </div>
              <div className="text-center">
                <span className={`text-4xl font-black ${articlesPending < 0 ? 'text-red-500' : 'text-indiapost-red'}`}>
                  {articlesPending}
                </span>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Articles</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="pendingReason" className="text-sm font-semibold text-slate-700">Reason for Pending / Daily Remarks</Label>
              <Textarea
                id="pendingReason"
                name="pendingReason"
                value={formData.pendingReason}
                onChange={handleChange}
                placeholder="Please enter daily remarks or reason for pending articles..."
                className="min-h-[120px] border-slate-300 focus-visible:ring-indiapost-red resize-none"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indiapost-red hover:bg-indiapost-dark text-white py-8 text-xl font-bold shadow-lg shadow-indiapost-red/20 transition-all active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-3 h-5 w-5" />
                  Submit Official Report
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <div className="bg-indiapost-yellow h-2 w-full" />
      </Card>
    </motion.div>
  );
}
