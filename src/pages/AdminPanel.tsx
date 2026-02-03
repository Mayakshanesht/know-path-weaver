import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Users, BarChart3 } from 'lucide-react';
import CoursesManager from '@/components/admin/CoursesManager';
import EnrollmentsManager from '@/components/admin/EnrollmentsManager';
import ProgressViewer from '@/components/admin/ProgressViewer';

export default function AdminPanel() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage courses, enrollments, and view student progress</p>
          </motion.div>

          <Tabs defaultValue="courses" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="courses" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Courses</span>
              </TabsTrigger>
              <TabsTrigger value="enrollments" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Enrollments</span>
              </TabsTrigger>
              <TabsTrigger value="progress" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses">
              <CoursesManager />
            </TabsContent>

            <TabsContent value="enrollments">
              <EnrollmentsManager />
            </TabsContent>

            <TabsContent value="progress">
              <ProgressViewer />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
