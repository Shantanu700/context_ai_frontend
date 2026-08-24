import { redirect } from "next/navigation";

/** Nothing to edit without a video — the library is where you pick one. */
export default function Page() {
  redirect("/projects");
}
