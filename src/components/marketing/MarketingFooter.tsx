import { Link } from 'react-router-dom';
import { DOMAINS } from '@/data/courses';

export default function MarketingFooter() {
  return (
    <footer className="bg-primary text-primary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center">
                <span className="font-bold text-lg">K</span>
              </div>
              <span className="font-bold text-2xl">KnowGraph</span>
            </Link>
            <p className="text-primary-foreground/80 text-lg">
              Graph-based learning for complex systems
            </p>
          </div>

          {/* Domains */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Used to deliver learning in</h4>
            <ul className="space-y-2 text-primary-foreground/80">
              {DOMAINS.map((domain) => (
                <li key={domain.name} className="flex items-center gap-2">
                  <span>{domain.icon}</span>
                  {domain.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Platform</h4>
            <ul className="space-y-2 text-primary-foreground/80">
              <li>
                <Link to="/" className="hover:text-primary-foreground transition-colors">
                  Courses
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-primary-foreground transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-primary-foreground transition-colors">
                  Join Beta
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/20 text-center text-primary-foreground/60">
          <p>© 2026 KnowGraph. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
