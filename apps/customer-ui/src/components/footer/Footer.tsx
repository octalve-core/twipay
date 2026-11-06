import { navlinks } from "@/lib/constants";
import Logo from "../navbar/Logo";
import { brand } from "@/config/brand";
import { Link, NavLink } from "react-router-dom";

import Twitter from "../../assets/main-pages/Twitter.png";
import LinkedIn from "../../assets/main-pages/LinkedIn.png";
import Facebook from "../../assets/main-pages/Facebook.png";
import { Instagram } from "lucide-react";

const socialLinks = [
  {
    id: 1,
    icon: Twitter,
    href: "/",
  },
  {
    id: 2,
    icon: LinkedIn,
    href: "/",
  },
  {
    id: 3,
    icon: Facebook,
    href: "/",
  },
];

const Footer = () => {
  return (
    <footer className="bg-white w-screen">
      <div className="container py-10 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start w-full">
          <div className="max-w-[320px]">
            <Logo />
            <p className="text-[#475467] mt-4">
              Enjoy amazing bill payment experiences that create more happy in
              the world.
            </p>
          </div>
          <div className="flex items-end w-full max-md:justify-between justify-end">
            <nav className="flex flex-col md:flex-row md:items-center gap-8 max-md:mt-8">
              {navlinks.map(
                ({ id, label, href }) =>
                  id !== 1 && (
                    <NavLink
                      key={id}
                      className={({ isActive }) =>
                        !isActive
                          ? "text-[#475467] font-normal hover:bg-[#1129290D] transition"
                          : "text-[#112929] font-medium"
                      }
                      to={href}
                    >
                      {label}
                    </NavLink>
                  ),
              )}
            </nav>
            <div className="flex md:hidden items-center gap-6">
              {socialLinks.map(({ id, icon, href }) => (
                <Link key={id} to={href}>
                  <img alt="" className="size-4 object-cover" src={icon} />
                </Link>
              ))}
              <Link className="hover:scale-110 transition" to="/">
                <Instagram className="size-4 text-[#667085]" />
              </Link>
            </div>
          </div>
        </div>
        {/* Divider line */}
        <div className="bg-[#EAECF0] h-[1px] mt-8 md:mt-16 mb-8 max-md:bg-transparent" />
        <div className="flex items-center justify-center md:justify-between">
          <p className="text-[#667085]">
            © 2026 {brand.name}. Operated by {brand.operator}.{" "}
            <Link to="/privacy-policy" className="underline hover:text-[#112929]">Privacy policy</Link>
          </p>
          <div className="hidden md:flex items-center gap-4 md:gap-6">
            {socialLinks.map(({ id, icon, href }) => (
              <Link className="hover:scale-110 transition" key={id} to={href}>
                <img alt="" className="size-4 object-cover" src={icon} />
              </Link>
            ))}
            <Link className="hover:scale-110 transition" to="/">
              <Instagram className="size-4 text-[#667085]" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
