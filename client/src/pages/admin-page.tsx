import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const { toast } = useToast();

  const handleResetRequest = () => {
    setShowConfirmation(true);
  };

  const handleCancelReset = () => {
    setShowConfirmation(false);
  };

  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      await apiRequest('POST', '/api/reset-data');
      
      toast({
        title: "Account reset successful",
        description: "All user accounts have been removed while preserving content data.",
      });
      
      setResetComplete(true);
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: "There was an error resetting the application data.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      
      {resetComplete && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            All user account information has been reset while preserving content data. New users will need to register accounts.
            <div className="mt-2">
              <a href="/auth" className="text-primary hover:underline">
                Go to registration page
              </a>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account Management</CardTitle>
          <CardDescription>
            Reset user accounts only. This will remove all user credentials (usernames, passwords, email addresses) while preserving all books, chats, and other content data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showConfirmation ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning!</AlertTitle>
              <AlertDescription>
                This will delete all user accounts and credentials, but preserve book listings and other content. 
                This action cannot be undone. Are you sure you want to continue?
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex justify-between">
          {showConfirmation ? (
            <>
              <Button variant="outline" onClick={handleCancelReset}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmReset}
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Confirm Reset
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button 
              variant="destructive" 
              onClick={handleResetRequest}
              disabled={resetComplete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Reset User Accounts
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}