import Link from "next/link";

const links: { name: string; href: string }[] = [
  { name: "Home", href: "/" },
  { name: "ethics", href: "/lections/ethics" },
  { name: "introduction", href: "/lections/introduction" },
  { name: "Experimental science", href: "/lections/experimental-science" },
  {
    name: "New european theory of knowledge",
    href: "/lections/new-european-theory-of-knowledge",
  },
];

export const AppHeader: React.FC = () => {
  return (
    <header className="grid">
      <nav className="flex items-center gap-4">
        {links.map((link) => (
          <Link key={link.name} href={link.href}>
            {link.name}
          </Link>
        ))}
      </nav>
    </header>
  );
};
