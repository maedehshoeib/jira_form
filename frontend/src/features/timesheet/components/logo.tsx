import logo from "../../../assets/logo.png";

export function Logo(): JSX.Element {
  return (
    <div className="mb-4 flex items-center justify-center py-4" aria-label="لوگو">
      <img
        src={logo}
        alt="توسعه اعتماد گستر وثوق"
        className="max-h-32 w-auto object-contain"
      />
    </div>
  );
}
