// The account has no profile picture today (the API sends none), so show initials instead of an <img alt="" src=""> that renders as a broken image.
export function initialsOf(firstname?: string, lastname?: string): string {
  const letters = [firstname, lastname].map((name) => name?.trim().charAt(0).toUpperCase() ?? "").join("");
  return letters || "?";
}

type UserAvatarProps = { avatar?: string | null; firstname?: string; lastname?: string; className?: string };

const UserAvatar = ({ avatar, firstname, lastname, className = "" }: UserAvatarProps) =>
  avatar ? (
    <img src={avatar} alt="" className={`size-full rounded-full object-cover bg-blue-100 ${className}`} />
  ) : (
    <span aria-hidden="true" className={`size-full rounded-full bg-blue-100 text-[#0B4DA2] grid place-items-center text-xs font-semibold ${className}`}>
      {initialsOf(firstname, lastname)}
    </span>
  );

export default UserAvatar;
