<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
  
	let { form }: { form: ActionData } = $props();
  </script>
  
  <div class="flex justify-center items-center min-h-screen bg-base-200">
	<div class="bg-base-100 p-6 rounded-lg shadow-lg w-full sm:w-96">
	  <h1 class="text-2xl font-bold mb-4 text-center">Login/Register</h1>
	  <form method="post" action="?/login" use:enhance>
		<label class="input input-bordered flex items-center gap-2 mb-4">
		  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-4 w-4 opacity-70">
			<path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z"/>
		  </svg>
		  <input type="text" name="username" class="grow" placeholder="Username" />
		</label>
  
		<label class="input input-bordered flex items-center gap-2 mb-4">
		  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-4 w-4 opacity-70">
			<path fill-rule="evenodd" d="M14 6a4 4 0 0 1-4.899 3.899l-1.955 1.955a.5.5 0 0 1-.353.146H5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2.293a.5.5 0 0 1 .146-.353l3.955-3.955A4 4 0 1 1 14 6Zm-4-2a.75.75 0 0 0 0 1.5.5.5 0 0 1 .5.5.75.75 0 0 0 1.5 0 2 2 0 0 0-2-2Z" clip-rule="evenodd"/>
		  </svg>
		  <input type="password" name="password" class="grow" value="password" />
		</label>
  
		  <button class="btn w-full mb-2">Login</button>
		  <button class="btn w-full mb-2" formaction="?/register">Register</button>
	  </form>
	  <p style="color: red">{form?.message ?? ''}</p>
	</div>
  </div>
  