"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PetForm = {
  id?: string; // existing pet ID for update requests
  pet_name: string;
  breed: string;
  age: string;
  weight_lbs: string;
  sex: string;
  temperament: string;
};

type Agreement = {
  id: string;
  title: string | null;
  agreement_text: string;
  is_required: boolean;
  sort_order: number;
};

type AgreementAcceptance = {
  agreement_id: string;
  accepted: boolean;
};

type OnboardingQuestion = {
  id: string;
  question_text: string;
  response_type: "text" | "yes_no" | "dropdown_single" | "dropdown_multi";
  options: string[];
  is_required: boolean;
  sort_order: number;
  applies_to?: "pet" | "client";
};

type QuestionAnswer = {
  question_id: string;
  response_type: string;
  answer: string | string[];
};

type PetQuestionnaire = {
  pet_index: number;
  answers: QuestionAnswer[];
};

type PetRecordType = {
  id: string;
  name: string;
  has_expiry: boolean;
  is_required: boolean;
  sort_order: number;
};

type PetRecordUpload = {
  id: string;
  pet_index: number;
  document_type: string;
  file: File;
};

type ExistingRecord = {
  pet_id: string;
  record_type_id: string | null;
  title: string | null;
  expires_at: string | null;
};

type QuestionResponse = {
  pet_id: string;
  question_id: string;
  answer: string | string[];
};

type PreFill = {
  owner_first_name: string;
  owner_last_name: string;
  phone: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  secondary_contact_name: string;
  secondary_contact_phone: string;
  pets: PetForm[];
  question_responses: QuestionResponse[];
  client_question_responses: { question_id: string; answer: string | string[] }[];
  existing_records: ExistingRecord[];
};

type BrandingResponse = {
  request_id: string;
  business_name: string;
  logo_url: string | null;
  status: string;
  client_email: string | null;
  agreements: Agreement[];
  pet_questions: OnboardingQuestion[];
  client_questions: OnboardingQuestion[];
  require_pet_records_onboarding: boolean;
  pet_record_types: PetRecordType[];
  is_update: boolean;
  customer_id: string | null;
  pre_fill: PreFill | null;
  error?: string;
};

// Vercel's serverless functions reject request bodies over ~4.5MB before
// our code ever runs, returning a plain-text/HTML error instead of JSON —
// which crashes the browser's response.json() with a cryptic parse error
// ("The string did not match the expected pattern") rather than a clean,
// readable message. Compressing photos client-side (and capping
// non-image files, which can't be compressed) keeps real-world uploads
// comfortably under that limit.
const MAX_IMAGE_DIMENSION = 1600; // px, longest side
const IMAGE_JPEG_QUALITY = 0.82;
const MAX_NON_IMAGE_FILE_BYTES = 4 * 1024 * 1024; // 4MB — e.g. PDFs

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );

    // Already small — leave it alone rather than re-encoding for no gain.
    if (scale >= 1 && file.size <= MAX_NON_IMAGE_FILE_BYTES) return file;

    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY),
    );

    if (!blob) return file;

    const compressedName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], compressedName, { type: "image/jpeg" });
  } catch {
    // If compression fails for any reason (unsupported format, etc.),
    // fall back to the original file rather than blocking the upload.
    return file;
  }
}

const emptyPet = (): PetForm => ({
  pet_name: "",
  breed: "",
  age: "",
  weight_lbs: "",
  sex: "",
  temperament: "",
});

function buildEmptyAnswers(questions: OnboardingQuestion[]): QuestionAnswer[] {
  return questions.map((question) => ({
    question_id: question.id,
    response_type: question.response_type,
    answer: question.response_type === "dropdown_multi" ? [] : "",
  }));
}

export default function OnboardingTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const isPreview = token?.startsWith("preview-") ?? false;
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);
  const [isUpdate, setIsUpdate] = useState(false);

  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [agreementAcceptances, setAgreementAcceptances] = useState<AgreementAcceptance[]>([]);
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [clientQuestions, setClientQuestions] = useState<OnboardingQuestion[]>([]);
  const [clientAnswers, setClientAnswers] = useState<QuestionAnswer[]>([]);
  const [requirePetRecords, setRequirePetRecords] = useState(false);
  const [petRecordTypes, setPetRecordTypes] = useState<PetRecordType[]>([]);
  const [petRecords, setPetRecords] = useState<PetRecordUpload[]>([]);
  // key: `${petIndex}:${typeId}` → expiry date string (yyyy-mm-dd)
  const [petRecordExpiries, setPetRecordExpiries] = useState<Record<string, string>>({});
  const [petQuestionnaires, setPetQuestionnaires] = useState<PetQuestionnaire[]>([]);
  const [existingRecords, setExistingRecords] = useState<ExistingRecord[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fileError, setFileError] = useState("");
  const [compressingFile, setCompressingFile] = useState(false);

  const [form, setForm] = useState({
    owner_first_name: "",
    owner_last_name: "",
    phone: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    secondary_contact_name: "",
    secondary_contact_phone: "",
    sms_opt_in: false,
  });

  const [pets, setPets] = useState<PetForm[]>([emptyPet()]);

  useEffect(() => {
    async function loadBranding() {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`/api/onboarding/${token}`);
        const result: BrandingResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load onboarding page.");
        }

        const loadedQuestions = result.pet_questions ?? [];
        const loadedClientQuestions = result.client_questions ?? [];

        setBusinessName(result.business_name);
        setLogoUrl(result.logo_url);
        setIsUpdate(result.is_update ?? false);
        setAgreements(result.agreements ?? []);
        setQuestions(loadedQuestions);
        setClientQuestions(loadedClientQuestions);
        setRequirePetRecords(result.require_pet_records_onboarding ?? false);
        setPetRecordTypes(result.pet_record_types ?? []);

        setAgreementAcceptances(
          (result.agreements ?? []).map((agreement) => ({
            agreement_id: agreement.id,
            accepted: false,
          })),
        );

        if (result.pre_fill) {
          // Pre-fill form for update requests
          const pf = result.pre_fill;
          setForm({
            owner_first_name: pf.owner_first_name,
            owner_last_name: pf.owner_last_name,
            phone: pf.phone,
            email: pf.email,
            address_line_1: pf.address_line_1,
            address_line_2: pf.address_line_2,
            city: pf.city,
            state: pf.state,
            postal_code: pf.postal_code,
            secondary_contact_name: pf.secondary_contact_name,
            secondary_contact_phone: pf.secondary_contact_phone,
            sms_opt_in: true, // already opted in as existing client
          });
          const prefillPets = pf.pets.length > 0 ? pf.pets : [emptyPet()];
          setPets(prefillPets);
          setExistingRecords(pf.existing_records ?? []);
          setPetQuestionnaires(
            prefillPets.map((pet, i) => {
              const petId = (pet as any).id as string | undefined;
              const responses = (pf.question_responses ?? []).filter(
                (r) => r.pet_id === petId,
              );
              const answers = buildEmptyAnswers(loadedQuestions).map((empty) => {
                const saved = responses.find((r) => r.question_id === empty.question_id);
                return saved ? { ...empty, answer: saved.answer } : empty;
              });
              return { pet_index: i, answers };
            }),
          );
          setClientAnswers(
            buildEmptyAnswers(loadedClientQuestions).map((empty) => {
              const saved = (pf.client_question_responses ?? []).find(
                (r) => r.question_id === empty.question_id,
              );
              return saved ? { ...empty, answer: saved.answer } : empty;
            }),
          );
        } else {
          if (result.client_email) {
            setLockedEmail(result.client_email);
            setForm((prev) => ({ ...prev, email: result.client_email! }));
          }
          setPetQuestionnaires([
            {
              pet_index: 0,
              answers: buildEmptyAnswers(loadedQuestions),
            },
          ]);
          setClientAnswers(buildEmptyAnswers(loadedClientQuestions));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load onboarding page.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadBranding();
    }
  }, [token]);

  function updateOwnerField(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePetField(index: number, key: keyof PetForm, value: string) {
    setPets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function updateAgreement(agreementId: string, accepted: boolean) {
    setAgreementAcceptances((prev) =>
      prev.map((item) =>
        item.agreement_id === agreementId ? { ...item, accepted } : item,
      ),
    );
  }

  function updatePetQuestionAnswer(petIndex: number, questionId: string, answer: string | string[]) {
    setPetQuestionnaires((prev) =>
      prev.map((petQuestionnaire) => {
        if (petQuestionnaire.pet_index !== petIndex) return petQuestionnaire;
        return {
          ...petQuestionnaire,
          answers: petQuestionnaire.answers.map((item) =>
            item.question_id === questionId ? { ...item, answer } : item,
          ),
        };
      }),
    );
  }

  function togglePetMultiSelectAnswer(petIndex: number, questionId: string, option: string) {
    setPetQuestionnaires((prev) =>
      prev.map((petQuestionnaire) => {
        if (petQuestionnaire.pet_index !== petIndex) return petQuestionnaire;
        return {
          ...petQuestionnaire,
          answers: petQuestionnaire.answers.map((item) => {
            if (item.question_id !== questionId) return item;
            const current = Array.isArray(item.answer) ? item.answer : [];
            const exists = current.includes(option);
            return { ...item, answer: exists ? current.filter((v) => v !== option) : [...current, option] };
          }),
        };
      }),
    );
  }

  function updateClientQuestionAnswer(questionId: string, answer: string | string[]) {
    setClientAnswers((prev) =>
      prev.map((item) =>
        item.question_id === questionId ? { ...item, answer } : item,
      ),
    );
  }

  function toggleClientMultiSelectAnswer(questionId: string, option: string) {
    setClientAnswers((prev) =>
      prev.map((item) => {
        if (item.question_id !== questionId) return item;
        const current = Array.isArray(item.answer) ? item.answer : [];
        const exists = current.includes(option);
        return { ...item, answer: exists ? current.filter((v) => v !== option) : [...current, option] };
      }),
    );
  }

  function getClientAnswer(questionId: string) {
    return clientAnswers.find((item) => item.question_id === questionId)?.answer ?? "";
  }

  function setExpiryDate(petIndex: number, typeId: string, value: string) {
    setPetRecordExpiries((prev) => ({
      ...prev,
      [`${petIndex}:${typeId}`]: value,
    }));
  }

  function getExpiryDate(petIndex: number, typeId: string): string {
    return petRecordExpiries[`${petIndex}:${typeId}`] ?? "";
  }

  async function addPetRecord(petIndex: number, documentType: string, file: File) {
    setFileError("");

    const isImage = file.type.startsWith("image/");

    if (!isImage && file.size > MAX_NON_IMAGE_FILE_BYTES) {
      setFileError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB, which is too large to upload. Please choose a file under 4MB.`,
      );
      return;
    }

    setCompressingFile(true);
    const processedFile = isImage ? await compressImageFile(file) : file;
    setCompressingFile(false);

    setPetRecords((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        pet_index: petIndex,
        document_type: documentType,
        file: processedFile,
      },
    ]);
  }

  function removePetRecord(recordId: string) {
    setPetRecords((prev) => prev.filter((record) => record.id !== recordId));
  }

  function getPetRecordsForType(petIndex: number, typeId: string) {
    return petRecords.filter(
      (record) => record.pet_index === petIndex && record.document_type === typeId,
    );
  }

  function getPetRecords(petIndex: number) {
    return petRecords.filter((record) => record.pet_index === petIndex);
  }

  function addPet() {
    setPets((prev) => [...prev, emptyPet()]);
    setPetQuestionnaires((prev) => [
      ...prev,
      { pet_index: prev.length, answers: buildEmptyAnswers(questions) },
    ]);
  }

  function removePet(index: number) {
    setPets((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });

    setPetQuestionnaires((prev) => {
      if (prev.length === 1) return prev;
      return prev
        .filter((item) => item.pet_index !== index)
        .map((item, newIndex) => ({ ...item, pet_index: newIndex }));
    });

    setPetRecords((prev) =>
      prev
        .filter((record) => record.pet_index !== index)
        .map((record) => ({
          ...record,
          pet_index: record.pet_index > index ? record.pet_index - 1 : record.pet_index,
        })),
    );
  }

  function validateRequiredQuestions() {
    const petsOk = pets.every((_, petIndex) => {
      const petQuestionnaire = petQuestionnaires.find((item) => item.pet_index === petIndex);
      return questions.every((question) => {
        if (!question.is_required) return true;
        const answer = petQuestionnaire?.answers.find((item) => item.question_id === question.id)?.answer;
        if (Array.isArray(answer)) return answer.length > 0;
        return String(answer ?? "").trim().length > 0;
      });
    });

    const clientOk = clientQuestions.every((question) => {
      if (!question.is_required) return true;
      const answer = getClientAnswer(question.id);
      if (Array.isArray(answer)) return answer.length > 0;
      return String(answer ?? "").trim().length > 0;
    });

    return petsOk && clientOk;
  }

  function validateRequiredRecordTypes(): string | null {
    if (petRecordTypes.length === 0) {
      if (requirePetRecords) {
        const missing = pets.some((pet, petIndex) => {
          const petId = (pet as any).id as string | undefined;
          const hasExisting = petId
            ? existingRecords.some((r) => r.pet_id === petId)
            : false;
          return !hasExisting && getPetRecords(petIndex).length === 0;
        });
        if (missing) return "Please upload at least one record for each pet.";
      }
      return null;
    }

    const requiredTypes = petRecordTypes.filter((t) => t.is_required);
    for (let petIndex = 0; petIndex < pets.length; petIndex++) {
      const petId = (pets[petIndex] as any).id as string | undefined;
      for (const type of requiredTypes) {
        const hasUpload = getPetRecordsForType(petIndex, type.id).length > 0;
        const hasExisting = petId
          ? existingRecords.some(
              (r) => r.pet_id === petId && r.record_type_id === type.id,
            )
          : false;
        if (!hasUpload && !hasExisting) {
          return `Please upload a ${type.name} for each pet.`;
        }
      }
    }
    return null;
  }

  function getPetAnswer(petIndex: number, questionId: string) {
    return (
      petQuestionnaires
        .find((item) => item.pet_index === petIndex)
        ?.answers.find((item) => item.question_id === questionId)?.answer ?? ""
    );
  }

  function renderQuestionInput(petIndex: number, question: OnboardingQuestion) {
    const answer = getPetAnswer(petIndex, question.id);

    if (question.response_type === "yes_no") {
      return (
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => updatePetQuestionAnswer(petIndex, question.id, e.target.value)}
          required={question.is_required}
        >
          <option value="">Select an answer</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    }

    if (question.response_type === "dropdown_single") {
      return (
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => updatePetQuestionAnswer(petIndex, question.id, e.target.value)}
          required={question.is_required}
        >
          <option value="">Select an answer</option>
          {question.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (question.response_type === "dropdown_multi") {
      const selected = Array.isArray(answer) ? answer : [];
      return (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={selected.includes(option)}
                onChange={() => togglePetMultiSelectAnswer(petIndex, question.id, option)}
              />
              <span className="text-sm text-[var(--text-secondary)]">{option}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <textarea
        placeholder="Type your answer"
        value={typeof answer === "string" ? answer : ""}
        onChange={(e) => updatePetQuestionAnswer(petIndex, question.id, e.target.value)}
        required={question.is_required}
        className="min-h-28"
      />
    );
  }

  function renderClientQuestionInput(question: OnboardingQuestion) {
    const answer = getClientAnswer(question.id);

    if (question.response_type === "yes_no") {
      return (
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => updateClientQuestionAnswer(question.id, e.target.value)}
          required={question.is_required}
        >
          <option value="">Select an answer</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    }

    if (question.response_type === "dropdown_single") {
      return (
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => updateClientQuestionAnswer(question.id, e.target.value)}
          required={question.is_required}
        >
          <option value="">Select an answer</option>
          {question.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (question.response_type === "dropdown_multi") {
      const selected = Array.isArray(answer) ? answer : [];
      return (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={selected.includes(option)}
                onChange={() => toggleClientMultiSelectAnswer(question.id, option)}
              />
              <span className="text-sm text-[var(--text-secondary)]">{option}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <textarea
        placeholder="Type your answer"
        value={typeof answer === "string" ? answer : ""}
        onChange={(e) => updateClientQuestionAnswer(question.id, e.target.value)}
        required={question.is_required}
        className="min-h-28"
      />
    );
  }

  function renderRecordsSection(petIndex: number) {
    const hasCustomTypes = petRecordTypes.length > 0;
    const hasRequiredTypes = petRecordTypes.some((t) => t.is_required);

    if (!hasCustomTypes && !requirePetRecords) return null;

    return (
      <div className="mt-6 border-t border-[var(--divider-soft)] pt-5">
        <h4 className="text-base font-semibold">
          Pet records
          {(hasRequiredTypes || (requirePetRecords && !hasCustomTypes)) && (
            <span className="text-[var(--rose-primary)]"> *</span>
          )}
        </h4>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {hasCustomTypes
            ? "Upload the required documents for this pet."
            : "Upload rabies certificates, vaccine records, vet notes, or PDFs."}
        </p>
        {compressingFile && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Preparing photo for upload…
          </p>
        )}
        {fileError && (
          <p className="mt-2 text-xs font-medium text-[var(--error-rose)]">
            {fileError}
          </p>
        )}

        {hasCustomTypes ? (
          <div className="mt-4 space-y-4">
            {petRecordTypes.map((recordType) => {
              const uploaded = getPetRecordsForType(petIndex, recordType.id);
              const expiryValue = getExpiryDate(petIndex, recordType.id);
              const petId = (pets[petIndex] as any)?.id as string | undefined;
              const onFileRecord = petId
                ? existingRecords.find(
                    (r) => r.pet_id === petId && r.record_type_id === recordType.id,
                  )
                : undefined;
              const showOnFile = !!onFileRecord && uploaded.length === 0;

              return (
                <div
                  key={recordType.id}
                  className="rounded-[16px] border border-[var(--divider-soft)] bg-[var(--cream-background)] p-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {recordType.name}
                      {recordType.is_required && (
                        <span className="text-[var(--rose-primary)]"> *</span>
                      )}
                      {!recordType.is_required && (
                        <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                          (optional)
                        </span>
                      )}
                    </span>
                    <label className="cursor-pointer rounded-lg border border-[var(--divider-soft)] bg-white px-3 py-2 text-xs font-semibold text-[var(--rose-primary)] transition hover:border-[var(--rose-primary)]">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          addPetRecord(petIndex, recordType.id, file);
                          e.currentTarget.value = "";
                        }}
                      />
                      {showOnFile ? "Replace" : "+ Upload"}
                    </label>
                  </div>

                  {recordType.has_expiry && (
                    <div className="mt-3 w-full min-w-0">
                      <label className="block w-full min-w-0">
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                          Expiry date
                        </span>
                        <div className="mt-1 w-full min-w-0">
                          <input
                            type="date"
                            value={expiryValue}
                            onChange={(e) => setExpiryDate(petIndex, recordType.id, e.target.value)}
                          />
                        </div>
                      </label>
                    </div>
                  )}

                  {showOnFile && (
                    <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[var(--divider-soft)] bg-white px-3 py-2">
                      <span className="text-xs text-green-600">✓</span>
                      <p className="truncate text-xs text-[var(--text-secondary)]">
                        On file: {onFileRecord.title ?? "Record"}
                        {onFileRecord.expires_at && (
                          <span className="ml-1">· expires {onFileRecord.expires_at}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {uploaded.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploaded.map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--divider-soft)] bg-white px-3 py-2"
                        >
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            ✓ {record.file.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => removePetRecord(record.id)}
                            className="shrink-0 text-xs font-medium text-[var(--error-rose)]"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Legacy: generic upload when no custom types configured
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {["rabies", "vaccines", "vet_note", "medication", "other"].map((type) => {
                const labels: Record<string, string> = {
                  rabies: "Rabies Certificate",
                  vaccines: "Vaccine Records",
                  vet_note: "Vet Note",
                  medication: "Medication Instructions",
                  other: "Other Record",
                };
                return (
                  <label
                    key={type}
                    className="cursor-pointer rounded-[16px] border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--rose-primary)]"
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        addPetRecord(petIndex, type, file);
                        e.currentTarget.value = "";
                      }}
                    />
                    Upload {labels[type]}
                  </label>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              {(() => {
                const petId = (pets[petIndex] as any)?.id as string | undefined;
                const onFile = petId
                  ? existingRecords.filter((r) => r.pet_id === petId)
                  : [];
                return onFile.map((r) => (
                  <div
                    key={r.record_type_id ?? r.title}
                    className="flex items-center gap-2 rounded-[14px] border border-[var(--divider-soft)] bg-white px-4 py-3"
                  >
                    <span className="text-xs text-green-600">✓</span>
                    <p className="truncate text-sm text-[var(--text-secondary)]">
                      On file: {r.title ?? "Record"}
                      {r.expires_at && (
                        <span className="ml-1">· expires {r.expires_at}</span>
                      )}
                    </p>
                  </div>
                ));
              })()}
              {getPetRecords(petIndex).length === 0 && existingRecords.filter((r) => r.pet_id === (pets[petIndex] as any)?.id).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No records uploaded yet.</p>
              ) : (
                getPetRecords(petIndex).map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--divider-soft)] bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {record.document_type}
                      </p>
                      <p className="truncate text-xs text-[var(--text-secondary)]">
                        {record.file.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePetRecord(record.id)}
                      className="shrink-0 rounded-lg border border-[rgba(184,92,114,0.2)] px-3 py-2 text-xs font-medium text-[var(--error-rose)]"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    if (!form.sms_opt_in) {
      setSubmitError("SMS consent is required to complete onboarding.");
      setSubmitting(false);
      return;
    }

    const missingRequiredAgreement = agreements.some((agreement) => {
      if (!agreement.is_required) return false;
      const accepted = agreementAcceptances.find((item) => item.agreement_id === agreement.id);
      return !accepted?.accepted;
    });

    if (missingRequiredAgreement) {
      setSubmitError("Please accept all required client agreements.");
      setSubmitting(false);
      return;
    }

    if (!validateRequiredQuestions()) {
      setSubmitError("Please answer all required questionnaire items for each pet.");
      setSubmitting(false);
      return;
    }

    const recordError = validateRequiredRecordTypes();
    if (recordError) {
      setSubmitError(recordError);
      setSubmitting(false);
      return;
    }

    try {
      const uploadPayload = petRecords.map((record, index) => {
        const fileKey = `pet_record_${index}`;
        const recordType = petRecordTypes.find((t) => t.id === record.document_type);
        const expiryDate = recordType?.has_expiry
          ? getExpiryDate(record.pet_index, record.document_type)
          : undefined;

        return {
          pet_index: record.pet_index,
          file_key: fileKey,
          document_type: record.document_type,
          title: recordType?.name ?? record.document_type,
          file_name: record.file.name,
          mime_type: record.file.type || "application/octet-stream",
          expiry_date: expiryDate || undefined,
        };
      });

      const formData = new FormData();

      formData.append(
        "payload",
        JSON.stringify({
          ...form,
          pets: pets.map((pet) => ({
            ...pet,
            // Include pet ID for existing pets in update requests
            id: pet.id ?? undefined,
          })),
          agreements: agreementAcceptances,
          pet_questionnaire: petQuestionnaires,
          client_questionnaire: clientAnswers,
          pet_records: uploadPayload,
        }),
      );

      petRecords.forEach((record, index) => {
        formData.append(`pet_record_${index}`, record.file);
      });

      const response = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        body: formData,
      });

      // A response can fail to be JSON for reasons that never reach our own
      // error handling — e.g. the platform rejecting an oversized upload
      // before it hits this route at all. Parse defensively so that shows
      // up as a clear message instead of a raw browser parse exception.
      const rawBody = await response.text();
      let result: { error?: string } = {};
      try {
        result = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        throw new Error(
          response.status === 413
            ? "Your upload is too large. Try a smaller photo or PDF and submit again."
            : `Something went wrong submitting the form (error ${response.status}). Please try again with a smaller photo/PDF, or contact your groomer if it keeps happening.`,
        );
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit onboarding form.");
      }

      if (isPreview) {
        setPreviewSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      router.push("/thank-you");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit onboarding form.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="site-shell flex min-h-screen items-center justify-center px-4">
        <div className="soft-card w-full max-w-xl p-8 text-center">
          <p className="text-[var(--text-secondary)]">Loading onboarding form...</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="site-shell flex min-h-screen items-center justify-center px-4">
        <div className="soft-card w-full max-w-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Unable to load form</h1>
          <p className="mt-3 text-[var(--text-secondary)]">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="site-shell min-h-screen px-4 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl">
        {isPreview ? (
          <div className="mb-6 rounded-[16px] border border-[var(--rose-primary)] bg-[rgba(184,92,114,0.08)] px-4 py-3 text-center text-sm font-semibold text-[var(--rose-primary)]">
            {previewSubmitted
              ? "Preview complete — nothing was saved or submitted."
              : "Preview mode — this is exactly what your clients see. Nothing you enter here will be saved."}
          </div>
        ) : null}
        <div className="soft-card mb-8 p-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-[var(--divider-soft)]"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--soft-surface)] text-2xl font-bold text-[var(--text-secondary)] ring-1 ring-[var(--divider-soft)]">
                {businessName ? businessName.charAt(0).toUpperCase() : "G"}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
                {isUpdate ? "Information update" : "Customer onboarding"}
              </p>
              <h1 className="text-3xl font-bold">{businessName}</h1>
              <p className="mt-2 text-[var(--text-secondary)]">
                {isUpdate
                  ? "Please review and update your information. Make any changes and submit when done."
                  : "Please complete your information before your appointment."}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="soft-card space-y-8 p-6">
          <section>
            <h2 className="text-xl font-semibold">Owner information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input placeholder="First name" value={form.owner_first_name} onChange={(e) => updateOwnerField("owner_first_name", e.target.value)} required />
              <input placeholder="Last name" value={form.owner_last_name} onChange={(e) => updateOwnerField("owner_last_name", e.target.value)} required />
              <input placeholder="Phone" value={form.phone} onChange={(e) => updateOwnerField("phone", e.target.value)} required />
              <div className="relative">
                <input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => !lockedEmail && updateOwnerField("email", e.target.value)}
                  readOnly={!!lockedEmail}
                  required
                  className={lockedEmail ? "bg-[var(--soft-surface)] text-[var(--text-secondary)] cursor-default" : ""}
                />
                {lockedEmail && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-600">✓ Verified</span>
                )}
              </div>
              <input className="sm:col-span-2" placeholder="Address line 1" value={form.address_line_1} onChange={(e) => updateOwnerField("address_line_1", e.target.value)} required />
              <input className="sm:col-span-2" placeholder="Address line 2 (optional)" value={form.address_line_2} onChange={(e) => updateOwnerField("address_line_2", e.target.value)} />
              <input placeholder="City" value={form.city} onChange={(e) => updateOwnerField("city", e.target.value)} required />
              <input placeholder="State" value={form.state} onChange={(e) => updateOwnerField("state", e.target.value)} required />
              <input placeholder="ZIP code" value={form.postal_code} onChange={(e) => updateOwnerField("postal_code", e.target.value)} required />
            </div>

            <div className="mt-6 rounded-[18px] border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Secondary contact <span className="text-sm font-normal text-[var(--text-secondary)]">(optional)</span>
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                An emergency or backup contact we can reach if needed.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <input placeholder="Name" value={form.secondary_contact_name} onChange={(e) => updateOwnerField("secondary_contact_name", e.target.value)} />
                <input placeholder="Phone number" value={form.secondary_contact_phone} onChange={(e) => updateOwnerField("secondary_contact_phone", e.target.value)} />
              </div>
            </div>

            {clientQuestions.length > 0 ? (
              <div className="mt-6 border-t border-[var(--divider-soft)] pt-5">
                <h3 className="text-base font-semibold">About you</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  A few questions about you as our client.
                </p>
                <div className="mt-4 space-y-4">
                  {clientQuestions.map((question) => (
                    <div key={question.id} className="rounded-[18px] border border-[var(--divider-soft)] bg-[var(--cream-background)] p-4">
                      <label className="block">
                        <span className="text-base font-semibold text-[var(--text-primary)]">
                          {question.question_text}
                          {question.is_required ? <span className="text-[var(--rose-primary)]"> *</span> : null}
                        </span>
                        <div className="mt-3">{renderClientQuestionInput(question)}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Pet information</h2>
              <button type="button" onClick={addPet} className="secondary-button px-4 py-2 text-sm">
                Add another pet
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {pets.map((pet, index) => (
                <div key={index} className="rounded-[22px] border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-4">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">Pet {index + 1}</h3>
                    {pets.length > 1 ? (
                      <button type="button" onClick={() => removePet(index)} className="rounded-lg border border-[rgba(184,92,114,0.2)] px-3 py-2 text-sm font-medium text-[var(--error-rose)] transition hover:bg-[rgba(184,92,114,0.08)]">
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input placeholder="Pet name" value={pet.pet_name} onChange={(e) => updatePetField(index, "pet_name", e.target.value)} required />
                    <input placeholder="Breed" value={pet.breed} onChange={(e) => updatePetField(index, "breed", e.target.value)} required />
                    <input placeholder="Age" value={pet.age} onChange={(e) => updatePetField(index, "age", e.target.value)} required />
                    <input placeholder="Weight (lbs)" type="number" min="0" step="0.1" value={pet.weight_lbs} onChange={(e) => updatePetField(index, "weight_lbs", e.target.value)} required />
                    <select value={pet.sex} onChange={(e) => updatePetField(index, "sex", e.target.value)} required>
                      <option value="">Select sex</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <input placeholder="Temperament" value={pet.temperament} onChange={(e) => updatePetField(index, "temperament", e.target.value)} required />
                  </div>

                  {questions.length > 0 ? (
                    <div className="mt-6 border-t border-[var(--divider-soft)] pt-5">
                      <h4 className="text-base font-semibold">Pet questionnaire</h4>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        These answers will be saved to this pet profile.
                      </p>
                      <div className="mt-4 space-y-4">
                        {questions.map((question) => (
                          <div key={question.id} className="rounded-[18px] border border-[var(--divider-soft)] bg-[var(--cream-background)] p-4">
                            <label className="block">
                              <span className="text-base font-semibold text-[var(--text-primary)]">
                                {question.question_text}
                                {question.is_required ? <span className="text-[var(--rose-primary)]"> *</span> : null}
                              </span>
                              <div className="mt-3">{renderQuestionInput(index, question)}</div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {renderRecordsSection(index)}
                </div>
              ))}
            </div>
          </section>

          {agreements.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold">Client agreements</h2>
              <div className="mt-4 space-y-4">
                {agreements.map((agreement) => {
                  const accepted = agreementAcceptances.find((item) => item.agreement_id === agreement.id)?.accepted ?? false;
                  return (
                    <div key={agreement.id} className="rounded-[22px] border border-[var(--divider-soft)] bg-[var(--soft-surface)] p-4">
                      {agreement.title ? <h3 className="text-base font-semibold text-[var(--text-primary)]">{agreement.title}</h3> : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
                        {agreement.agreement_text}
                      </p>
                      <label className="mt-4 inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 shrink-0" checked={accepted} onChange={(e) => updateAgreement(agreement.id, e.target.checked)} required={agreement.is_required} />
                        <span className="text-sm leading-5 text-[var(--text-secondary)]">
                          I understand{agreement.is_required ? " (required)" : ""}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-xl font-semibold">SMS reminders</h2>
            <label className="mt-4 inline-flex max-w-full cursor-pointer items-start gap-2 rounded-lg border border-[var(--divider-soft)] bg-[var(--cream-background)] px-4 py-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={form.sms_opt_in} onChange={(e) => updateOwnerField("sms_opt_in", e.target.checked)} required />
              <span className="text-sm leading-5 text-[var(--text-secondary)]">
                I agree to receive SMS appointment reminders and updates.
                <span className="font-medium text-[var(--text-primary)]"> This is required to complete onboarding.</span>
              </span>
            </label>
          </section>

          {submitError ? <div className="error-banner px-4 py-3 text-sm">{submitError}</div> : null}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              Your information will be used for appointment onboarding.
            </p>
            <button type="submit" disabled={submitting} className="primary-button px-5 py-3">
              {submitting ? "Submitting..." : isUpdate ? "Submit update" : "Submit onboarding"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
