"use client";

import { useTransition } from "react";
import { IconClock, IconClockOff } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clockIn, clockOut } from "@/lib/attendance/actions";

type ClockInOutCardProps = {
  isClockedIn: boolean;
  locationLabel?: string;
};

export function ClockInOutCard({
  isClockedIn,
  locationLabel = "Default location",
}: ClockInOutCardProps) {
  const [pending, startTransition] = useTransition();

  function handleClock() {
    startTransition(async () => {
      const result = isClockedIn ? await clockOut() : await clockIn();
      if (result.ok) {
        toast.success(isClockedIn ? "Clocked out" : "Clocked in");
      } else {
        toast.error(result.error ?? "Unable to record attendance.");
      }
    });
  }

  return (
    <Card className="">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base text-navy">
          Clock In / Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="min-h-11 w-full bg-green-strong text-white hover:bg-green"
          disabled={pending}
          onClick={handleClock}
        >
          {isClockedIn ? (
            <>
              <IconClockOff stroke={1.75} className="size-5" />
              Clock Out
            </>
          ) : (
            <>
              <IconClock stroke={1.75} className="size-5" />
              Clock In
            </>
          )}
        </Button>
        <p className="text-sm text-slate">
          {locationLabel}{" "}
          <button type="button" className="text-green-strong underline-offset-2 hover:underline">
            Change location
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
