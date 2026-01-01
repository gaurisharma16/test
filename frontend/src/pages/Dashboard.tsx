import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Edit3, 
  FileBarChart, 
  TrendingUp, 
  Bell,
  Database,
  Cloud,
  Cpu,
  Code,
  Brain
} from "lucide-react";

const Dashboard = () => {
  const Shell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`relative group ${className ?? ""}`}>
      <div className="absolute -inset-[1.5px] rounded-2xl bg-gradient-to-r from-primary/40 via-accent/40 to-secondary/40 blur opacity-70 group-hover:opacity-100 transition duration-500" />
      <Card className="relative rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-lg">
        {children}
      </Card>
    </div>
  );
  const projects = [
    {
      id: 1,
      title: "Financial Data Extraction & Analysis Application",
      description: "A web application that processes unstructured financial statements (press releases, reports) to extract and structure key financial metrics. Includes performance analysis tailored to company type (e.g., Banks, REITs, Corporations) and an administrative dashboard for usage analytics.",
      icon: FileText,
      deliverables: [
        "User interface for file upload and results display",
        "Fully deployed web application",
        "Administrative dashboard for user statistics"
      ]
    },
    {
      id: 2,
      title: "AI-Powered Editorial Assistant for Google Docs",
      description: "A custom AI editor that improves editorial quality and consistency by providing AI-driven suggestions. Features include headline generation, style guide adherence, tone and readability checks, and automated formatting corrections.",
      icon: Edit3,
      deliverables: [
        '"Generate Headlines" module',
        '"Edit with AI" module aligned with client style guide',
        "Dashboard for user analytics",
        "User manuals and quick-start guides",
        "User testing at each development phase"
      ]
    },
    {
      id: 3,
      title: "Broker Report Article Generation Tool",
      description: "A web application that synthesizes multiple broker reports into a single article, highlighting changes in stock recommendations, target prices, and other key takeaways. Includes an administrative dashboard for analytics.",
      icon: FileBarChart,
      deliverables: [
        "Deployed application for broker report processing",
        "Dashboard for user statistics and continuous improvement"
      ]
    },
    {
      id: 4,
      title: "Automated Daily Financial Market Summary",
      description: "An end-to-end system that scrapes public financial websites to generate a templated daily market summary article with charts. Covers stock index performance, market breadth, trading volumes, top/bottom performers, regional market performance, and analyst quotes.",
      icon: TrendingUp,
      deliverables: [
        "Automated data extraction system",
        "Two types of auto-generated daily charts",
        "Dashboard for analytics and improvement"
      ]
    },
    {
      id: 5,
      title: "Corporate Filings Alert System",
      description: "A monitoring tool that tracks corporate financial report filings with a regulatory authority. Sends alerts for companies on a user-configurable watch list.",
      icon: Bell,
      deliverables: [
        "Functional automated filing tracker",
        "Integrated notification system",
        "User management for watch list"
      ]
    }
  ];

  const techStack = [
    { name: "React.js", icon: Code, category: "Frontend" },
    { name: "Python (FastAPI)", icon: Code, category: "Backend" },
    { name: "Gemini API", icon: Brain, category: "AI/ML" },
    { name: "Hugging Face", icon: Brain, category: "AI/ML" },
    { name: "RAG & Chroma DB", icon: Brain, category: "AI/ML" },
    { name: "BeautifulSoup", icon: FileText, category: "Data Extraction" },
    { name: "Scrapy", icon: FileText, category: "Data Extraction" },
    { name: "Pandas", icon: FileText, category: "Data Extraction" },
    { name: "MongoDB", icon: Database, category: "Database" },
    { name: "GCP", icon: Cloud, category: "Deployment" }
  ];

  const objectives = [
    "Increase efficiency, speed, and consistency in financial news reporting",
    "Automate repetitive editorial and analytical tasks",
    "Provide actionable insights through AI-powered data processing",
    "Enable real-time monitoring of corporate filings and market movements"
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-background">

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="">
          <div className="container mx-auto max-w-6xl px-4 pt-16 pb-14">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-secondary">
                  AI-Powered Financial Content & Workflow Automation
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-lg md:text-xl text-slate-600 dark:text-slate-300">
                Transform financial content creation, editorial workflows, and market analysis with elegant, production-ready AI tools.
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <a href="#projects" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-3 text-primary-foreground shadow-lg hover:scale-[1.02] active:scale-[0.99] transition">
                  Explore Projects
                </a>
                <a href="#overview" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card text-foreground backdrop-blur px-5 py-3 shadow-sm hover:bg-card/90 transition">
                  Learn More
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="bg-card/80 backdrop-blur border border-border">React</Badge>
                <Badge variant="secondary" className="bg-card/80 backdrop-blur border border-border">FastAPI</Badge>
                <Badge variant="secondary" className="bg-card/80 backdrop-blur border border-border">MongoDB</Badge>
                <Badge variant="secondary" className="bg-card/80 backdrop-blur border border-border">Gemini</Badge>
                <Badge variant="secondary" className="bg-card/80 backdrop-blur border border-border">Hugging Face</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-12">
        {/* Overview Section */}
        <section id="overview" className="scroll-mt-24">
          <Shell className="mb-12">
            <CardHeader>
              <CardTitle className="text-3xl">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-muted-foreground leading-relaxed">
                This project is a collection of AI-driven tools designed to automate and enhance financial content creation,
                editorial processes, and market data analysis. The suite includes applications for extracting financial data,
                assisting editors, generating broker report summaries, producing automated market summaries, and monitoring
                corporate filings.
              </p>
            </CardContent>
          </Shell>
        </section>

        {/* Objectives Section */}
        <section id="objectives" className="scroll-mt-24">
          <Shell className="mb-12">
            <CardHeader>
              <CardTitle className="text-3xl">Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid sm:grid-cols-2 gap-3">
                {objectives.map((objective, index) => (
                  <li key={index} className="flex items-start rounded-lg border border-border bg-card/70 backdrop-blur p-3">
                    <span className="mt-1 mr-3 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-r from-primary to-accent" />
                    <span className="text-base md:text-lg text-muted-foreground">{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Shell>
        </section>

        {/* Projects Section */}
        <section id="projects" className="scroll-mt-24 mb-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-secondary">Projects & Deliverables</span>
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Elegant apps, pragmatic features, production-ready quality.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project) => {
              const IconComponent = project.icon;
              return (
                <Shell key={project.id}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-muted text-primary">
                        <IconComponent className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{project.title}</CardTitle>
                        <CardDescription className="text-base leading-relaxed">
                          {project.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h4 className="font-semibold mb-3 text-lg">Deliverables</h4>
                    <ul className="space-y-2">
                      {project.deliverables.map((deliverable, index) => (
                        <li key={index} className="flex items-start">
                          <span className="mt-2 mr-3 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-r from-primary to-accent" />
                          <span className="text-muted-foreground">{deliverable}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Shell>
              );
            })}
          </div>
        </section>

        {/* Technology Stack Section */}
        <section id="tech" className="scroll-mt-24">
          <Shell>
            <CardHeader>
              <CardTitle className="text-3xl">Technology Stack</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {techStack.map((tech, index) => {
                  const IconComponent = tech.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/70 backdrop-blur hover:translate-y-[-2px] hover:shadow transition"
                    >
                      <IconComponent className="w-6 h-6 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{tech.name}</p>
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {tech.category}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Shell>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
