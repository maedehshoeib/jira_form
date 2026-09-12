import { cn } from "@/lib/utils";

type LoginMascotProps = {
  className?: string;
};

export default function LoginMascot({ className }: LoginMascotProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative flex w-full max-w-[280px] shrink-0 items-center justify-center sm:max-w-[320px] lg:max-w-[380px]",
        className,
      )}
    >
      <div className="login-mascot-glow absolute inset-[18%] rounded-full bg-primary/20 blur-3xl dark:bg-primary/30" />
      {/* Native <img> keeps GIF animation; next/image freezes animated GIFs. */}
      <img
        src="/login-mascot.gif"
        alt=""
        width={384}
        height={576}
        className="login-mascot-media relative z-10 h-auto w-full"
        draggable={false}
      />
    </div>
  );
}
