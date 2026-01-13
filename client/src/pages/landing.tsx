import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";
import {
  Clock,
  Shield,
  BarChart3,
  Users,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: Clock,
      title: "Easy Submissions",
      description:
        "Submit overtime hours in seconds with our intuitive form. Track time ranges or enter total hours directly.",
    },
    {
      icon: Shield,
      title: "Streamlined Approvals",
      description:
        "Department-wise approval queues with real-time notifications. Approve or reject with detailed comments.",
    },
    {
      icon: BarChart3,
      title: "Comprehensive Reports",
      description:
        "Generate detailed reports by employee, department, or date range. Export to CSV for payroll processing.",
    },
    {
      icon: Users,
      title: "Role-Based Access",
      description:
        "Support for Employees, Approvers, and Admins with fine-grained permissions and multi-department support.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-semibold text-xl">OvertimeTracker</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild data-testid="button-login">
              <Link href="/auth">Sign In</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="pt-32 pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                    Simplify Your{" "}
                    <span className="text-primary">Overtime Hours</span>{" "}
                    Management
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-xl">
                    A comprehensive solution for submitting, approving, and
                    tracking overtime hours across your organization. Built for
                    efficiency and compliance.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button
                    size="lg"
                    asChild
                    className="gap-2"
                    data-testid="button-get-started"
                  >
                    <Link href="/auth">
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    data-testid="button-learn-more"
                  >
                    <a href="#features">Learn More</a>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Free to use</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Secure & compliant</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur-3xl" />
                <Card className="relative overflow-hidden border-2">
                  <CardContent className="p-0">
                    <div className="bg-sidebar p-4 border-b">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="h-4 w-32 bg-muted rounded" />
                          <div className="h-3 w-20 bg-muted/60 rounded" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary/10" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="p-4 rounded-lg bg-card border"
                          >
                            <div className="h-8 w-8 rounded bg-primary/10 mb-3" />
                            <div className="h-6 w-12 bg-muted rounded mb-1" />
                            <div className="h-3 w-16 bg-muted/60 rounded" />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 rounded-lg bg-card border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-muted" />
                              <div className="space-y-1">
                                <div className="h-3 w-24 bg-muted rounded" />
                                <div className="h-2 w-16 bg-muted/60 rounded" />
                              </div>
                            </div>
                            <div className="h-6 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 px-6 bg-card/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A complete suite of tools for managing overtime hours, from
                submission to approval to reporting.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join organizations that trust OvertimeTracker for their hours
              management needs. Set up in minutes, not days.
            </p>
            <Button
              size="lg"
              asChild
              className="gap-2"
              data-testid="button-cta-signup"
            >
              <Link href="/auth">
                Start Using OvertimeTracker
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">OvertimeTracker</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} OvertimeTracker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
