import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setError('Invalid verification link.');
        setIsLoading(false);
        return;
      }

      try {
        await authApi.verifyEmail(token);
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } catch (err: any) {
        setError(err.message || 'Failed to verify email. The link may have expired.');
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [token, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Verifying your email...</CardTitle>
            <CardDescription>Please wait while we verify your email address</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Email Verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified. Redirecting to login...
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate('/login')}>Go to Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Verification Failed</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col space-y-2">
          <Button onClick={() => navigate('/register')} className="w-full">
            Back to Registration
          </Button>
          <Button onClick={() => navigate('/login')} variant="outline" className="w-full">
            Go to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VerifyEmail;
