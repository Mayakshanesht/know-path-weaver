import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { COURSES } from '@/data/courses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function CoursesSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Available Courses</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Industry-aligned curriculum designed for engineers and serious learners
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {COURSES.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <Card className="h-full flex flex-col overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-3">
                  {/* Powered by badge */}
                  <Badge variant="outline" className="w-fit mb-3 text-xs font-normal">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Powered by KnowGraph Capsules
                  </Badge>
                  
                  <h3 className="text-xl font-bold leading-tight">
                    <span className="mr-2">{course.emoji}</span>
                    {course.shortTitle}
                  </h3>
                </CardHeader>

                <CardContent className="flex-1">
                  <p className="text-muted-foreground">
                    {course.description}
                  </p>
                </CardContent>

                <CardFooter className="pt-4 border-t border-border">
                  <Button asChild className="w-full group-hover:bg-primary/90">
                    <Link to={`/course/${course.slug}`}>
                      View Course
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
