import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
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

  const handleAnswer = (value: string) => {
    if (currentQuestion.type !== "intro" && "key" in currentQuestion) {
      setAnswers((prev) => ({ ...prev, [currentQuestion.key]: value }));
    }
  };

  const canProceed = () => {
    if (currentQuestion.type === "intro") return true;
    if (currentQuestion.type === "textarea") return true;
    if ("key" in currentQuestion) {
      return answers[currentQuestion.key] !== "";
    }
    return false;
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("encuestas").insert([
        {
          pregunta1_amabilidad: answers.pregunta1_amabilidad,
          pregunta2_tiempo_espera: answers.pregunta2_tiempo_espera,
          pregunta3_resolucion_dudas: answers.pregunta3_resolucion_dudas,
          pregunta4_limpieza: answers.pregunta4_limpieza,
          pregunta5_calificacion_general: answers.pregunta5_calificacion_general,
          comentario: answers.comentario || null,
          estado_kanban: answers.comentario ? "Bandeja de Entrada" : null,
        },
      ]);

      if (error) throw error;

      setCurrentStep(totalSteps);
    } catch (error) {
      console.error("Error submitting survey:", error);
      toast.error("Hubo un error al enviar la encuesta. Por favor, intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentStep === totalSteps) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--survey-bg))] px-4">
        <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in-50 duration-700">
          <div className="space-y-4">
            <h1 
              className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] bg-clip-text text-transparent"
            >
              ¡Gracias!
            </h1>
            <p className="text-xl text-[hsl(var(--survey-text-light))] opacity-90">
              Su opinión es muy importante para nosotros y nos ayuda a mejorar continuamente nuestros servicios.
            </p>
          </div>
          <div className="pt-8">
            <Button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold px-8 py-6 text-lg hover:opacity-90 transition-opacity"
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--survey-bg))] text-[hsl(var(--survey-text))] flex flex-col">
      {/* Progress Bar */}
      <div className="w-full bg-black/50 p-4 space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-center text-sm text-[hsl(var(--survey-text-light))]">
          Pregunta {currentStep + 1} de {totalSteps}
        </p>
      </div>

      {/* Question Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-3xl w-full space-y-12 animate-in fade-in-50 duration-300">
          <h2 className="text-2xl md:text-4xl font-medium text-[hsl(var(--survey-text-light))] text-center leading-relaxed">
            {currentQuestion.text}
          </h2>

          {currentQuestion.type === "intro" && (
            <div className="flex justify-center pt-8">
              <Button
                onClick={handleNext}
                size="lg"
                className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold px-12 py-6 text-lg hover:opacity-90 transition-opacity"
              >
                Comenzar
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {currentQuestion.type === "textarea" && (
            <div className="space-y-6">
              <Textarea
                value={answers.comentario}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Escriba su comentario aquí..."
                className="min-h-[200px] text-lg bg-white/5 border-white/20 text-[hsl(var(--survey-text-light))] placeholder:text-[hsl(var(--survey-text))]"
              />
            </div>
          )}

          {!currentQuestion.type && "options" in currentQuestion && (
            <div className="grid gap-4 max-w-xl mx-auto">
              {currentQuestion.options.map((option) => (
                <Button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  variant={
                    answers[currentQuestion.key] === option ? "default" : "outline"
                  }
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
      </div>

      {/* Navigation */}
      {currentQuestion.type !== "intro" && (
        <div className="p-6 flex justify-between items-center border-t border-white/10">
          <Button
            onClick={handlePrevious}
            variant="ghost"
            disabled={currentStep === 1}
            className="text-[hsl(var(--survey-text-light))] hover:bg-white/5"
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            Anterior
          </Button>

          {currentStep < questions.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              Siguiente
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold hover:opacity-90 transition-opacity"
            >
              {isSubmitting ? "Enviando..." : "Enviar"}
              <Send className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Survey;
