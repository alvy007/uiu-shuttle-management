export type RouteActionState = {
  status: 'idle' | 'error';
  message: string;

  fieldErrors: {
    routeName?: string;
    shortName?: string;
    origin?: string;
    destination?: string;
    description?: string;
  };

  values: {
    routeName: string;
    shortName: string;
    origin: string;
    destination: string;
    description: string;
    isActive: boolean;
  };
};

export const initialRouteActionState: RouteActionState = {
  status: 'idle',
  message: '',

  fieldErrors: {},

  values: {
    routeName: '',
    shortName: '',
    origin: '',
    destination: '',
    description: '',
    isActive: true,
  },
};
