import type { ProfileDraft } from "./types";

export const defaultProfile: ProfileDraft = {
  fullName: "Narendhiran V",
  degree:
    "B.Tech student in Mechanical Engineering with a minor in Computer Science",
  school: "National Institute of Technology Tiruchirappalli",
  location: "Tiruchirappalli, India",
  phone: "+91 9444749184",
  defaultSubject: "Seeking Undergraduate Research Opportunity under your guidance",
  introduction:
    "I am writing to express my interest in contributing to your research group through a research internship and longer-term graduate study.",
  closingText:
    "I would be grateful for the chance to contribute on-site or remotely. Thank you for considering my note.",
  researchFields: [
    {
      id: "computer-vision",
      name: "Computer Vision",
      highlights: [
        "Co-authored a free-space segmentation pipeline for monocular robot navigation at IIT Bombay.",
        "Built a conversational image recognition chatbot with multimodal perception for the Smart India Hackathon finale.",
        "Developed perception and path planning workflows for autonomous aerial vehicle competitions including SAE AeroTHON and MathWorks Minidrone.",
      ],
    },
    {
      id: "robotics",
      name: "Robotics",
      highlights: [
        "Led development of autonomous drone systems with hotspot detection, telemetry, and return-to-home behavior.",
        "Worked on embedded-friendly perception pipelines for robots and quadcopters using real-time constraints.",
        "Built simulation-driven robotics workflows using Gazebo, QGroundControl SITL, MAVLink, and Raspberry Pi/Pixhawk integrations.",
      ],
    },
    {
      id: "robotics-and-computer-vision",
      name: "Robotics and Computer Vision",
      highlights: [
        "Developed a free-space segmentation model for the Kobuki Turtlebot with publication-oriented research rigor.",
        "Built lightweight learning systems for robotic assistive devices, including sequence modeling for gait transitions.",
        "Combined robotics deployment constraints with modern computer vision and deep learning methods across research projects.",
      ],
    },
  ],
  honors: [
    "Qualified among the top teams nationally in SAE AeroTHON.",
    "Worked on research collaborations spanning IIT Bombay and Monash University contexts.",
    "Contributed to paper drafts and submission-ready project writeups in robotics and human-computer interaction.",
  ],
  publicationBlurb:
    "My recent work spans robot navigation, embodied AI, human-computer interaction, and applied deep learning, with projects moving toward conference and journal submission.",
  goodEmailExamples: "",
};
