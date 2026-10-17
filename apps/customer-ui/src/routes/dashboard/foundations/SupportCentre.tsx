import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FoundationPage,
  FoundationPanel,
  FoundationLink,
} from "@/components/design-system/ErhaFoundationUI";
import {
  getSupportCase,
  listSupportCases,
  openSupportCase,
  replySupportCase,
  type SupportCaseSummary,
} from "@/lib/api/dashboard-apis/supportCases";
const input =
  "w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929]";
const readable = (status: string) =>
  status === "WAITING_SUPPORT"
    ? "Awaiting our reply"
    : status === "WAITING_CUSTOMER"
      ? "Reply available"
      : "Closed";
/** Keeps the existing ErhaPay layout and never persists private message text in browser storage. */
export default function SupportCentre() {
  const qc = useQueryClient();
  const cases = useQuery({
    queryKey: ["twipay", "support-cases"],
    queryFn: listSupportCases,
    retry: false,
    refetchInterval: 15000,
  });
  const [chosen, setChosen] = useState<SupportCaseSummary | null>(null);
  const caseView = useQuery({
    queryKey: ["twipay", "support-case", chosen?.reference],
    queryFn: () => getSupportCase(chosen!.reference),
    enabled: !!chosen,
    retry: false,
    refetchInterval: 15000,
  });
  const [category, setCategory] = useState<"GENERAL" | "ACCOUNT" | "EVENTS" | "TECHNICAL">(
    "GENERAL",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const submitLock = useRef(false);
  const createKey = useRef<string | null>(null);
  const replyKey = useRef<string | null>(null);
  async function create(e: FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setFeedback("");
    createKey.current ??= crypto.randomUUID();
    try {
      const result = await openSupportCase({
        category,
        subject: subject.trim(),
        message: message.trim(),
        requestKey: createKey.current,
      });
      createKey.current = null;
      setSubject("");
      setMessage("");
      setChosen(result);
      setFeedback("Your support request has been received.");
      await qc.invalidateQueries({ queryKey: ["twipay", "support-cases"] });
    } catch {
      setFeedback(
        "We could not confirm this request. Please check your request history before trying again.",
      );
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }
  async function respond(e: FormEvent) {
    e.preventDefault();
    if (submitLock.current || !chosen) return;
    submitLock.current = true;
    setBusy(true);
    setFeedback("");
    replyKey.current ??= crypto.randomUUID();
    try {
      await replySupportCase(chosen.reference, {
        message: reply.trim(),
        requestKey: replyKey.current,
      });
      replyKey.current = null;
      setReply("");
      setFeedback("Your reply was added.");
      await qc.invalidateQueries({ queryKey: ["twipay", "support-case", chosen.reference] });
      await qc.invalidateQueries({ queryKey: ["twipay", "support-cases"] });
    } catch {
      setFeedback("We could not confirm this reply. Review the conversation before retrying.");
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }
  return (
    <FoundationPage title="Help and support" description="Find answers or ask our team for help.">
      <FoundationPanel title="Support options">
        <FoundationLink
          to="/dashboard/settings/support"
          title="Report a transaction issue"
          description="Open a dispute for a transaction on your account."
        />
        <FoundationLink
          to="/dashboard/settings/faqs"
          title="Frequently asked questions"
          description="Find answers to common questions."
        />
      </FoundationPanel>
      <FoundationPanel
        title="Send a support request"
        description="For general help, account questions and event enquiries. Never include passwords, transaction PINs, verification codes or identity documents."
      >
        <form onSubmit={create} className="mt-3 space-y-3">
          <label className="block text-sm text-[#344054]" htmlFor="support-category">
            Category
            <select
              id="support-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className={input}
            >
              <option value="GENERAL">General</option>
              <option value="ACCOUNT">Account</option>
              <option value="EVENTS">Events</option>
              <option value="TECHNICAL">Technical help</option>
            </select>
          </label>
          <label className="block text-sm text-[#344054]" htmlFor="support-subject">
            Subject
            <input
              id="support-subject"
              className={input}
              minLength={5}
              maxLength={140}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                createKey.current = null;
              }}
              required
            />
          </label>
          <label className="block text-sm text-[#344054]" htmlFor="support-message">
            How can we help?
            <textarea
              id="support-message"
              className={input}
              minLength={10}
              maxLength={3000}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                createKey.current = null;
              }}
              rows={4}
              required
            />
          </label>
          <p className="text-xs text-[#727884]">
            Attachments are not accepted. Our team will advise if more evidence is needed.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-[#112929] px-4 py-2 text-white text-sm disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </form>
      </FoundationPanel>
      <FoundationPanel
        title="My support requests"
        description="Replies and status updates for your requests."
      >
        {cases.isPending && <p role="status">Loading requests…</p>}
        {cases.isError && <p role="alert">Support history is unavailable.</p>}
        {cases.data?.length === 0 && (
          <p className="text-sm text-[#727884]">No support requests yet.</p>
        )}
        <div className="space-y-2">
          {cases.data?.map((item) => (
            <button
              key={item.reference}
              type="button"
              onClick={() => {
                setChosen(item);
                setReply("");
                replyKey.current = null;
              }}
              className="w-full text-left rounded-md border p-3 text-sm hover:border-[#112929]"
            >
              <span className="block font-medium text-[#112929]">{item.subject}</span>
              <span className="text-[#667085]">
                {readable(item.status)} · {new Date(item.updatedAt).toLocaleDateString("en-NG")}
              </span>
            </button>
          ))}
        </div>
        {chosen && (
          <section className="mt-5 border-t pt-4" aria-label="Support conversation">
            <h3 className="font-medium text-[#112929]">{chosen.subject}</h3>
            {caseView.isPending && <p>Loading conversation…</p>}
            {caseView.isError && <p role="alert">Conversation is unavailable.</p>}
            <div className="space-y-3 my-4">
              {caseView.data?.messages.map((item) => (
                <div key={item.id} className="rounded-md bg-white p-3 border text-sm">
                  <p className="font-medium text-[#112929]">
                    {item.authorType === "STAFF" ? "TwiPay support" : "You"} ·{" "}
                    {new Date(item.createdAt).toLocaleString("en-NG")}
                  </p>
                  <p className="text-[#344054] whitespace-pre-wrap break-words mt-1">{item.text}</p>
                </div>
              ))}
            </div>
            {caseView.data?.status !== "CLOSED" && (
              <form onSubmit={respond}>
                <label className="block text-sm text-[#344054]" htmlFor="support-reply">
                  Reply
                  <textarea
                    id="support-reply"
                    className={input}
                    minLength={2}
                    maxLength={3000}
                    rows={3}
                    required
                    value={reply}
                    onChange={(e) => {
                      setReply(e.target.value);
                      replyKey.current = null;
                    }}
                  />
                </label>
                <button
                  className="rounded-md bg-[#112929] px-4 py-2 text-white text-sm mt-2 disabled:opacity-60"
                  disabled={busy}
                >
                  Send reply
                </button>
              </form>
            )}
            {caseView.data?.status === "CLOSED" && (
              <p className="text-sm text-[#727884]">
                This request has been closed. You can open a new request if you still need help.
              </p>
            )}
          </section>
        )}
      </FoundationPanel>
      {feedback && (
        <p role="status" className="text-sm text-[#344054]">
          {feedback}
        </p>
      )}
    </FoundationPage>
  );
}
