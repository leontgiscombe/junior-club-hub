// How to find a team's FA Full-Time code: Full-Time's Code Snippets page, what
// to choose there, and which part of the snippet to copy. Under the code box
// in sign-up and Settings → Teams.
const SNIPPETS = "https://fulltime-admin.thefa.com/CreateCodeSnippet.html";

export default function FaCodeHelp({ after }: { after?: string }) {
  return (
    <div className="mt-1 text-xs text-gray-400">
      <p>To find it:</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-4">
        <li>
          Open{" "}
          <a
            href={SNIPPETS}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-green-700 underline dark:text-green-400"
          >
            Full-Time admin → Media → Code Snippets
          </a>
          .
        </li>
        <li>
          Choose <strong>Team Fixtures/Results</strong>.
        </li>
        <li>
          Select your <strong>division</strong>, then your <strong>team</strong>
          .
        </li>
        <li>
          Make sure <strong>Fixtures</strong>, <strong>Results</strong> and{" "}
          <strong>County Cup Fixtures</strong> are all selected.
        </li>
        <li>
          From the snippet it gives you, copy just the number after{" "}
          <code>lrcode</code>, not the whole snippet.
        </li>
      </ol>
      <p className="mt-1">
        Fixtures and results then arrive in the Match Log by themselves.
        {after ? ` ${after}` : ""}
      </p>
    </div>
  );
}
