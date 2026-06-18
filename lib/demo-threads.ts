/**
 * Demo DM threads shared between the Messages list and the DM conversation
 * screen. Static content for the hackathon demo — there is no messaging
 * backend. Avatars are derived deterministically from the name by <Avatar>.
 */
export type DemoThread = {
  id: string;
  name: string;
  preview: string;
  time: string;
  unread: boolean;
};

export const THREADS: DemoThread[] = [
  {
    id: "velour",
    name: "Velour",
    preview: "New set just dropped — first one's on me 🥂",
    time: "2m",
    unread: true,
  },
  {
    id: "maison-rouge",
    name: "Maison Rouge",
    preview: "You unlocked the whole series, legend.",
    time: "Jun 14",
    unread: false,
  },
  {
    id: "noir-studio",
    name: "Noir Studio",
    preview: "Are you coming to the rooftop shoot?",
    time: "Jun 10",
    unread: false,
  },
];

export function getThread(id: string): DemoThread | undefined {
  return THREADS.find((t) => t.id === id);
}
