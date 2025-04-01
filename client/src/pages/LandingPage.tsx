import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// Team member data
const teamMembers = [
  {
    name: "Alex Johnson",
    role: "Frontend Developer",
    image: "https://images.unsplash.com/photo-1557862921-37829c790f19?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Mia Williams",
    role: "Backend Developer",
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "David Chen",
    role: "UI/UX Designer",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Sarah Martinez",
    role: "Project Manager",
    image: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80",
  }
];

// Feature data
const features = [
  {
    icon: "ri-team-line",
    title: "Group Creation",
    description: "Form study groups with classmates based on courses, projects, or interests."
  },
  {
    icon: "ri-chat-3-line",
    title: "Real-time Chat",
    description: "Communicate with group members using a familiar chat interface."
  },
  {
    icon: "ri-task-line",
    title: "Task Management",
    description: "Create, assign, and track tasks with automatic submission verification."
  },
  {
    icon: "ri-admin-line",
    title: "Admin Controls",
    description: "Special permissions for group admins to create and manage tasks."
  },
  {
    icon: "ri-trophy-line",
    title: "Leaderboard",
    description: "Track progress and achievement with real-time updated leaderboards."
  },
  {
    icon: "ri-code-box-line",
    title: "LeetCode Integration",
    description: "Automatic tracking of coding problem submissions via GraphQL."
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center">
            <i className="ri-group-line text-primary text-3xl mr-2"></i>
            <h1 className="text-xl md:text-2xl font-semibold text-neutral-dark">StudyConnect</h1>
          </div>
          <nav className="hidden md:flex space-x-8">
            <a href="#features" className="text-neutral-dark hover:text-primary">Features</a>
            <a href="#about" className="text-neutral-dark hover:text-primary">About</a>
            <a href="#team" className="text-neutral-dark hover:text-primary">Team</a>
          </nav>
          <button id="mobile-menu-button" className="md:hidden text-neutral-dark">
            <i className="ri-menu-line text-2xl"></i>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary-dark text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col md:flex-row md:items-center">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Connect, Collaborate, and Excel Together
              </h1>
              <p className="text-xl mb-8 text-white/90">
                A community platform built by students, for students. Form groups, chat with peers, track tasks, and climb the leaderboard.
              </p>
              <Link href="/auth">
                <Button className="bg-white text-primary hover:bg-neutral-light font-semibold py-3 px-6 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
                  Get Started
                </Button>
              </Link>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <img 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80" 
                alt="Students collaborating" 
                className="rounded-lg shadow-2xl w-full max-w-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-neutral-light rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                <div className="bg-primary/10 w-14 h-14 flex items-center justify-center rounded-full mb-4">
                  <i className={`${feature.icon} text-2xl text-primary`}></i>
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-neutral-dark/80">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 bg-neutral-light">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">About the Project</h2>
            <p className="text-lg mb-8 text-neutral-dark/80">
              StudyConnect is a student community platform designed to enhance collaborative learning experiences. Our platform enables students to create and join groups, engage in real-time discussions, manage tasks, and track progress through leaderboards.
            </p>
            <p className="text-lg mb-8 text-neutral-dark/80">
              The platform was developed as part of a student-led initiative to improve peer-to-peer learning and collaboration in academic environments. The intuitive interface, inspired by popular communication tools, ensures a familiar and productive experience.
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {teamMembers.map((member, index) => (
              <div key={index} className="bg-neutral-light rounded-xl p-6 text-center shadow-md hover:shadow-lg transition-shadow">
                <img 
                  src={member.image} 
                  alt={member.name} 
                  className="w-32 h-32 object-cover rounded-full mx-auto mb-4"
                />
                <h3 className="text-xl font-semibold mb-1">{member.name}</h3>
                <p className="text-neutral-dark/70 mb-3">{member.role}</p>
                <div className="flex justify-center space-x-3">
                  <a href="#" className="text-neutral-dark hover:text-primary"><i className="ri-github-fill text-xl"></i></a>
                  <a href="#" className="text-neutral-dark hover:text-primary"><i className="ri-linkedin-box-fill text-xl"></i></a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-dark text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <i className="ri-group-line text-white text-2xl mr-2"></i>
              <h2 className="text-xl font-semibold">StudyConnect</h2>
            </div>
            <div className="flex flex-col md:flex-row md:space-x-8 items-center">
              <a href="#" className="hover:text-primary-light mb-2 md:mb-0">Privacy Policy</a>
              <a href="#" className="hover:text-primary-light mb-2 md:mb-0">Terms of Service</a>
              <a href="#" className="hover:text-primary-light">Contact Us</a>
            </div>
          </div>
          <div className="mt-6 text-center text-white/70">
            <p>&copy; {new Date().getFullYear()} StudyConnect. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
