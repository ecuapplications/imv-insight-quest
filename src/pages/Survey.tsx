import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { getDeviceId, hasSubmittedToday, markSubmittedToday } from "@/lib/deviceId";
import { ChevronLeft, ChevronRight, Send, ThumbsUp, ThumbsDown } from "lucide-react"; // 1. Importamos los iconos
import { toast } from "sonner";

type Answers = {
  pregunta1_amabilidad: string;
  pregunta2_tiempo_espera: string;
  pregunta3_resolucion_dudas: string;
  pregunta4_limpieza: string;
  pregunta5_calificacion_general: string;
  comentario: string;
};

const Survey = () => {
  const navigate = useNavigate();
  const { codigo } = useParams<{ codigo?: string }>();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    pregunta1_amabilidad: "",
    pregunta2_tiempo_espera: "",
    pregunta3_resolucion_dudas: "",
    pregunta4_limpieza: "",
    pregunta5_calificacion_general: "",
    comentario: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [formLoadedAt] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [alreadyToday, setAlreadyToday] = useState(() => !codigo && hasSubmittedToday());
  const [linkAlreadyUsed, setLinkAlreadyUsed] = useState(false);

  useEffect(() => {
    (window as any).onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    (window as any).onTurnstileExpired = () => setTurnstileToken("");
    return () => {
      delete (window as any).onTurnstileSuccess;
      delete (window as any).onTurnstileExpired;
    };
  }, []);

  const totalSteps = 7; // Intro + 5 questions + comment

  const questions = [
    {
      text: "Hola, le saludamos del equipo de gestión de calidad del IMV Health Digestive, agradecemos que nos dedique unos minutos de su tiempo para responder la siguiente encuesta:",
      type: "intro",
    },
    {
      text: "¿Fue atendido(a) con amabilidad y respeto a su llegada?",
      key: "pregunta1_amabilidad" as keyof Answers,
      options: ["Sí", "No"],
    },
    {
      text: "¿Cuánto tiempo esperó desde que llegó hasta que fue atendido en recepción?",
      key: "pregunta2_tiempo_espera" as keyof Answers,
      options: ["Menos de 5 minutos", "Entre 5 y 10 minutos", "Más de 10 minutos"],
    },
    {
      text: "¿El personal de recepción logró resolver sus dudas de manera clara y certera?",
      key: "pregunta3_resolucion_dudas" as keyof Answers,
      options: ["Sí", "No", "No tenía"],
    },
    {
      text: "¿Cómo evaluaría la organización y limpieza del área de recepción?",
      key: "pregunta4_limpieza" as keyof Answers,
      options: ["Excelente", "Buena", "Regular", "Mala"],
    },
    {
      text: "¿Cómo calificaría la atención del personal de recepción?",
      key: "pregunta5_calificacion_general" as keyof Answers,
      options: ["Excelente", "Buena", "Regular", "Mala"],
    },
    {
      text: "Déjanos un comentario, sugerencia o felicitación para el personal de recepción 😊",
      key: "comentario" as keyof Answers,
      type: "textarea",
    },
  ];

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // --- (El resto de las funciones no cambian) ---
  const handleAnswer = (value: string) => {
    if (currentQuestion.type !== "intro" && "key" in currentQuestion) {
      setAnswers((prev) => ({ ...prev, [currentQuestion.key]: value }));
    }
  };

  const canProceed = () => {
    if (currentQuestion.type === "intro" || currentQuestion.type === "textarea") return true;
    if ("key" in currentQuestion) return answers[currentQuestion.key] !== "";
    return false;
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await api.post("/encuestas.php", {
        pregunta1_amabilidad: answers.pregunta1_amabilidad,
        pregunta2_tiempo_espera: answers.pregunta2_tiempo_espera,
        pregunta3_resolucion_dudas: answers.pregunta3_resolucion_dudas,
        pregunta4_limpieza: answers.pregunta4_limpieza,
        pregunta5_calificacion_general: answers.pregunta5_calificacion_general,
        comentario: answers.comentario || null,
        sitio_web: honeypot,
        segundos_transcurridos: Math.round((Date.now() - formLoadedAt) / 1000),
        turnstile_token: turnstileToken,
        device_id: getDeviceId(),
        codigo_enlace: codigo || null,
      });
      if (error) {
        if (error.includes("Ya registraste tu encuesta hoy")) {
          markSubmittedToday();
          setAlreadyToday(true);
          return;
        }
        if (error.includes("enlace ya fue utilizado")) {
          setLinkAlreadyUsed(true);
          return;
        }
        throw new Error(error);
      }
      if (!codigo) markSubmittedToday();
      setCurrentStep(totalSteps);
    } catch (error) {
      console.error("Error submitting survey:", error);
      toast.error("Hubo un error al enviar la encuesta. Por favor, intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentStep === totalSteps || alreadyToday || linkAlreadyUsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--survey-bg))] px-4">
        <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in-50 duration-700">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] bg-clip-text text-transparent">
              {linkAlreadyUsed ? "Enlace ya utilizado" : "¡Gracias!"}
            </h1>
            <p className="text-xl text-[hsl(var(--survey-text-light))] opacity-90">
              {linkAlreadyUsed
                ? "Este enlace ya fue utilizado para responder la encuesta. Si crees que esto es un error, contacta a recepción."
                : alreadyToday
                  ? "Ya registraste tu opinión hoy. ¡Gracias por tu participación!"
                  : "Su opinión es muy importante para nosotros y nos ayuda a mejorar continuamente nuestros servicios."}
            </p>
          </div>
          {!linkAlreadyUsed && (
            <div className="pt-8">
              <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold px-8 py-6 text-lg hover:opacity-90 transition-opacity">
                Volver al inicio
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--survey-bg))] text-[hsl(var(--survey-text))] flex flex-col">
      <input
        type="text"
        name="sitio_web"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
        aria-hidden="true"
      />
      <div className="w-full bg-black/50 p-4 space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-center text-sm text-[hsl(var(--survey-text-light))]">
          Pregunta {currentStep > 0 ? currentStep : 1} de {totalSteps - 1}
        </p>
        <img src="/logo.png" alt="Logotipo de IMV Health Digestive" className="mx-auto h-20 w-auto pt-2" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-3xl w-full space-y-12 animate-in fade-in-50 duration-300">
          <h2 className="text-2xl md:text-4xl font-medium text-[hsl(var(--survey-text-light))] text-center leading-relaxed">
            {currentQuestion.text}
          </h2>

          {currentQuestion.type === "intro" && (
            <div className="flex justify-center pt-8">
              <Button onClick={handleNext} size="lg" className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold px-12 py-6 text-lg hover:opacity-90 transition-opacity">
                Comenzar <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {currentQuestion.type === "textarea" && (
            <div className="space-y-6">
              <Textarea value={answers.comentario} onChange={(e) => handleAnswer(e.target.value)} placeholder="Escriba su comentario aquí..." className="min-h-[200px] text-lg bg-white/5 border-white/20 text-[hsl(var(--survey-text-light))] placeholder:text-[hsl(var(--survey-text))]" />
              <div className="flex justify-center">
                <div
                  className="cf-turnstile"
                  data-sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  data-callback="onTurnstileSuccess"
                  data-expired-callback="onTurnstileExpired"
                />
              </div>
            </div>
          )}

          {/* --- 2. Lógica para mostrar los botones --- */}
          {!currentQuestion.type && "key" in currentQuestion && (
            <div className="max-w-xl mx-auto">
              {/* Si es la pregunta de amabilidad, usa 2 columnas */}
              {currentQuestion.key === "pregunta1_amabilidad" ? (
                <div className="grid grid-cols-2 gap-4">
                  {currentQuestion.options.map((option) => (
                    <Button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      variant={answers[currentQuestion.key] === option ? "default" : "outline"}
                      size="lg"
                      className={`h-auto py-6 text-lg font-medium transition-all gap-3 ${
                        answers[currentQuestion.key] === option
                          ? "bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black border-0"
                          : "bg-white/5 border-white/20 text-[hsl(var(--survey-text-light))] hover:bg-white/10"
                      }`}
                    >
                      {option === "Sí" && <ThumbsUp />}
                      {option === "No" && <ThumbsDown />}
                      {option}
                    </Button>
                  ))}
                </div>
              ) : (
                // Para el resto de preguntas, usa 1 columna
                <div className="grid gap-4">
                  {currentQuestion.options.map((option) => (
                    <Button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      variant={answers[currentQuestion.key] === option ? "default" : "outline"}
                      size="lg"
                      className={`h-auto py-6 text-lg font-medium transition-all ${
                        answers[currentQuestion.key] === option
                          ? "bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black border-0"
                          : "bg-white/5 border-white/20 text-[hsl(var(--survey-text-light))] hover:bg-white/10"
                      }`}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {currentQuestion.type !== "intro" && (
        <div className="p-6 flex justify-between items-center border-t border-white/10">
          <Button onClick={handlePrevious} variant="ghost" disabled={currentStep === 1} className="text-[hsl(var(--survey-text-light))] hover:bg-white/5">
            <ChevronLeft className="mr-2 h-5 w-5" /> Anterior
          </Button>
          {currentStep < questions.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()} className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-30">
              Siguiente <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting || !turnstileToken} className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-30">
              {isSubmitting ? "Enviando..." : "Enviar"} <Send className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Survey;