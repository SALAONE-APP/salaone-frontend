import { useContext } from "react";

import { RelationshipTourContext } from "../context/TourContext";

export function useRelationshipTour() {
  const context = useContext(RelationshipTourContext);

  if (!context) {
    throw new Error("useRelationshipTour precisa ser usado dentro de RelationshipTourProvider.");
  }

  return context;
}
