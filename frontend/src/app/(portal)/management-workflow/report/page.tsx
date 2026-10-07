import { redirect } from "next/navigation";

export default function Page() {
  redirect("/my-letters?report=external");
}
