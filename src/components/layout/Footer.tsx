import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">K</span>
              </div>
              <span className="font-bold text-xl">KnowGraph</span>
            </Link>
            <p className="text-muted-foreground max-w-sm">
              Graph-based learning platform with structured capsule courses and prerequisite tracking.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/courses" className="text-muted-foreground hover:text-foreground transition-colors">
                  Courses
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
                  Join Beta
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>support@knowgraph.com</li>
              <li>Beta v1.0</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} KnowGraph. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made with ❤️ for learners everywhere
          </p>
        </div>
      </div>
    </footer>
  );
}
