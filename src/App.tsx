/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, LogOut, FileText, History, Package } from 'lucide-react';
import ReportForm from './components/ReportForm';
import ReportList from './components/ReportList';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const ADMIN_EMAIL = 'tukukalandi@gmail.com';
  const isAdmin = user?.email === ADMIN_EMAIL && user?.emailVerified;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indiapost-red"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indiapost-red selection:text-white">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indiapost-red p-2 rounded-lg shadow-md shadow-indiapost-red/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-indiapost-yellow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">PMV Toolkit</h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-indiapost-red mt-1">India Post / Official Reporter</p>
            </div>
          </div>
          
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold leading-none capitalize">
                  {isAdmin ? '🛡️ Administrator' : user.displayName}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{user.email}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="hover:bg-slate-100 gap-2 border border-slate-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xs:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleLogin}
              variant="outline"
              className="border-indiapost-red text-indiapost-red hover:bg-indiapost-red hover:text-white gap-2 transition-all font-bold"
            >
              <LogIn className="w-4 h-4" />
              Admin Portal
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="submit" className="space-y-8">
          {isAdmin && (
            <div className="flex justify-center">
              <TabsList className="bg-slate-200/50 p-1 border border-slate-300/50 rounded-xl">
                <TabsTrigger 
                  value="submit" 
                  className="data-[state=active]:bg-indiapost-red data-[state=active]:text-white data-[state=active]:shadow-lg gap-2 px-8 py-2.5 rounded-lg transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Submission Form
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="data-[state=active]:bg-indiapost-red data-[state=active]:text-white data-[state=active]:shadow-lg gap-2 px-8 py-2.5 rounded-lg transition-all"
                >
                  <History className="w-4 h-4" />
                  Admin Dashboard
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          <AnimatePresence mode="wait">
            <TabsContent value="submit" key="tab-submit">
              <ReportForm />
            </TabsContent>
            
            {isAdmin && (
              <TabsContent value="history" key="tab-history">
                <ReportList />
              </TabsContent>
            )}

            {!isAdmin && (
              <TabsContent value="history" key="unauthorized">
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-400">Restricted Area</h2>
                  <p className="text-slate-400 mt-2">Only administrators can view the report history.</p>
                </div>
              </TabsContent>
            )}
          </AnimatePresence>
        </Tabs>
      </main>

      <footer className="py-8 border-t border-slate-200 mt-auto bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            PMV Toolkit / <span className="text-indiapost-red">Secure Internal System</span> / v1.0.0
          </p>
          <div className="flex justify-center gap-4 mt-4 opacity-30">
            <div className="w-12 h-1 bg-indiapost-red rounded-full" />
            <div className="w-12 h-1 bg-indiapost-yellow rounded-full" />
            <div className="w-12 h-1 bg-indiapost-red rounded-full" />
          </div>
        </div>
      </footer>
    </div>
  );
}
